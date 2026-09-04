import { ConflictError, ForbiddenError, ResourceNotFoundError } from '@salon/shared';
import type { AppointmentEntity } from '../../domain/entities/appointment.entity.js';
import { computeTimedSegments } from '../../domain/services/segment-timing.js';
import type {
  CreateAppointmentData,
  IAppointmentRepository,
  ResolvedAppointmentSegment,
} from '../ports/appointment-repository.port.js';
import type {
  IBranchValidator,
  IBusinessMemberValidator,
  ICustomerValidator,
  IServiceValidator,
  IStaffValidator,
} from '../ports/appointment-validators.port.js';
import { AppointmentAvailabilityGuard } from '../services/appointment-availability.guard.js';

/**
 * Creates a new appointment by booking one or more service segments
 * onto a staff member's calendar.
 *
 * Responsibilities:
 *  1. Validates tenant-scoped entity ownership (branch, customer, staff,
 *     service, created-by member) via narrow validator ports.
 *  2. Resolves historical service & staff snapshots via domain query ports
 *     in the application layer (maintaining strict module boundaries).
 *  3. Enforces branch hours, staff shifts, time-off, and branch service
 *     bookability via AppointmentAvailabilityGuard.
 *  4. Delegates to `IAppointmentRepository.reserve()` with resolved snapshots
 *     for atomic persistence across appointment-owned tables.
 *  5. Maps SQLSTATE 23P01 (GiST EXCLUDE violation) → ConflictError
 *     inside the repository via `handleExclusionViolation`.
 */
export class CreateAppointmentUseCase {
  private readonly availabilityGuard: AppointmentAvailabilityGuard;

  constructor(
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly branchValidator: IBranchValidator,
    private readonly customerValidator: ICustomerValidator,
    private readonly staffValidator: IStaffValidator,
    private readonly serviceValidator: IServiceValidator,
    private readonly businessMemberValidator: IBusinessMemberValidator,
    availabilityGuard?: AppointmentAvailabilityGuard,
  ) {
    this.availabilityGuard =
      availabilityGuard ??
      new AppointmentAvailabilityGuard(
        this.branchValidator,
        this.staffValidator,
        this.serviceValidator,
      );
  }

  async execute(data: CreateAppointmentData): Promise<AppointmentEntity> {
    // ── 1. Validate branch belongs to the tenant ─────────────────────────
    if (!(await this.branchValidator.isBranchInBusiness(data.businessId, data.branchId))) {
      throw new ResourceNotFoundError('Branch not found in this business');
    }

    // ── 2. Validate customer exists and is active in the tenant ───────────
    if (
      !(await this.customerValidator.isCustomerInBusiness(data.businessId, data.businessCustomerId))
    ) {
      throw new ResourceNotFoundError('Active customer not found in this business');
    }

    // ── 3. Validate created-by business member (if provided) ──────────────
    if (data.createdByBusinessMemberId) {
      if (
        !(await this.businessMemberValidator.isBusinessMemberInBusiness(
          data.businessId,
          data.createdByBusinessMemberId,
        ))
      ) {
        throw new ForbiddenError('Business member does not belong to this business');
      }
    }

    // ── 4. Batch-resolve immutable service and staff snapshots via domain query ports ──
    const serviceIds = Array.from(new Set(data.segments.map((s) => s.serviceId)));
    const serviceSnapshots = await this.serviceValidator.getServiceSnapshots(
      data.businessId,
      serviceIds,
    );
    const serviceMap = new Map(serviceSnapshots.map((s) => [s.id, s]));

    const staffRequests = data.segments.map((s) => ({
      staffMemberId: s.staffMemberId,
      serviceId: s.serviceId,
    }));
    const staffSnapshots = await this.staffValidator.getStaffBookingSnapshots(
      data.businessId,
      staffRequests,
    );
    const staffMap = new Map(
      staffSnapshots.map((st) => [`${st.staffMemberId}:${st.serviceId}`, st]),
    );

    const resolvedSegments: Array<
      Omit<
        ResolvedAppointmentSegment,
        'startsAt' | 'endsAt' | 'occupiedStart' | 'occupiedEnd' | 'sequence'
      >
    > = [];
    for (const segment of data.segments) {
      const svc = serviceMap.get(segment.serviceId);
      if (!svc?.isActive) {
        throw new ResourceNotFoundError(`Service ${segment.serviceId} not found in this business`);
      }

      const st = staffMap.get(`${segment.staffMemberId}:${segment.serviceId}`);
      if (!st?.isActive) {
        throw new ConflictError(
          `Staff member ${segment.staffMemberId} is not active in this business`,
        );
      }
      if (!st.isBookable) {
        throw new ConflictError(
          `Staff member ${segment.staffMemberId} cannot be booked for service ${segment.serviceId}`,
        );
      }

      const unitPrice = st.overridePrice ?? svc.defaultPrice;
      const durationMinutes =
        segment.overrideDurationMinutes ?? st.overrideDurationMinutes ?? svc.defaultDurationMinutes;

      resolvedSegments.push({
        serviceId: segment.serviceId,
        serviceName: svc.name,
        staffMemberId: segment.staffMemberId,
        staffDisplayName: st.displayName,
        unitPrice,
        durationMinutes,
        bufferBeforeMinutes: svc.bufferBeforeMinutes,
        bufferAfterMinutes: svc.bufferAfterMinutes,
        notes: segment.notes,
      });
    }

    // ── 5. Derive segment sequential timings & buffer-aware occupied intervals ──
    const timedSegments = computeTimedSegments(
      data.scheduledStartAt,
      resolvedSegments.map((s) => ({
        staffMemberId: s.staffMemberId,
        durationMinutes: s.durationMinutes,
        bufferBeforeMinutes: s.bufferBeforeMinutes,
        bufferAfterMinutes: s.bufferAfterMinutes,
      })),
    );

    const timedResolvedSegments: ResolvedAppointmentSegment[] = resolvedSegments.map((seg, i) => {
      const timing = timedSegments[i];
      if (!timing) {
        throw new Error('Internal invariant: timing mismatch during appointment creation.');
      }
      return {
        ...seg,
        startsAt: timing.startsAt,
        endsAt: timing.endsAt,
        occupiedStart: timing.occupiedStart,
        occupiedEnd: timing.occupiedEnd,
        sequence: timing.sequence,
      };
    });

    const scheduledEndAt = timedSegments[timedSegments.length - 1]?.endsAt ?? data.scheduledStartAt;
    const initialStatus = data.bookingChannel === 'marketplace' ? 'pending' : 'confirmed';

    // ── 6. Enforce branch hours, shifts, time-off, and branch bookability ──
    await this.availabilityGuard.assertBookable({
      businessId: data.businessId,
      branchId: data.branchId,
      bookingChannel: data.bookingChannel,
      scheduledStartAt: data.scheduledStartAt,
      scheduledEndAt,
      segments: timedResolvedSegments.map((s) => ({
        serviceId: s.serviceId,
        staffMemberId: s.staffMemberId,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
      })),
    });

    // ── 7. Atomically reserve the slot + create the appointment ────────────
    return await this.appointmentRepository.reserve({
      businessId: data.businessId,
      branchId: data.branchId,
      businessCustomerId: data.businessCustomerId,
      scheduledStartAt: data.scheduledStartAt,
      scheduledEndAt,
      bookingChannel: data.bookingChannel,
      initialStatus,
      segments: timedResolvedSegments,
      createdByBusinessMemberId: data.createdByBusinessMemberId,
      createdByUserId: data.createdByUserId,
    });
  }
}
