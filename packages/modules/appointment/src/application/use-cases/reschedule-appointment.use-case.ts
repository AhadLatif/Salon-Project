import { ConflictError, ResourceNotFoundError } from '@salon/shared';
import type { AppointmentEntity } from '../../domain/entities/appointment.entity.js';
import { computeTimedSegments } from '../../domain/services/segment-timing.js';
import type {
  IAppointmentRepository,
  RescheduleAppointmentData,
} from '../ports/appointment-repository.port.js';
import type {
  IBranchValidator,
  IServiceValidator,
  IStaffValidator,
} from '../ports/appointment-validators.port.js';
import { AppointmentAvailabilityGuard } from '../services/appointment-availability.guard.js';

export class RescheduleAppointmentUseCase {
  private readonly availabilityGuard: AppointmentAvailabilityGuard;

  constructor(
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly branchValidator: IBranchValidator,
    private readonly staffValidator: IStaffValidator,
    private readonly serviceValidator: IServiceValidator,
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

  async execute(data: RescheduleAppointmentData): Promise<AppointmentEntity> {
    // 1. Fetch existing appointment with segments
    const appt = await this.appointmentRepository.findById(data.businessId, data.appointmentId);
    if (!appt) {
      throw new ResourceNotFoundError(
        `Appointment ${data.appointmentId} not found in this business`,
      );
    }

    // 2. Reject terminal statuses
    if (appt.status === 'completed' || appt.status === 'cancelled' || appt.status === 'no_show') {
      throw new ConflictError(
        `Cannot reschedule an appointment in terminal status "${appt.status}".`,
      );
    }

    // 3. Derive sequential segment timings for the new start instant
    const timedSegments = computeTimedSegments(
      data.newScheduledStartAt,
      appt.segments.map((seg) => ({
        staffMemberId: seg.staffMemberId,
        durationMinutes: seg.durationMinutes,
        bufferBeforeMinutes: seg.bufferBeforeMinutes,
        bufferAfterMinutes: seg.bufferAfterMinutes,
      })),
    );

    const plannedSegments = appt.segments.map((seg, i) => {
      const timing = timedSegments[i];
      if (!timing) {
        throw new Error('Internal invariant: timing mismatch during reschedule.');
      }
      return {
        serviceId: seg.serviceId,
        staffMemberId: seg.staffMemberId,
        startsAt: timing.startsAt,
        endsAt: timing.endsAt,
      };
    });
    const scheduledEndAt =
      timedSegments[timedSegments.length - 1]?.endsAt ?? data.newScheduledStartAt;

    // 4. Validate branch hours, staff shifts, time-off, and branch bookability via guard
    await this.availabilityGuard.assertBookable({
      businessId: data.businessId,
      branchId: appt.branchId,
      bookingChannel: appt.bookingChannel,
      scheduledStartAt: data.newScheduledStartAt,
      scheduledEndAt,
      segments: plannedSegments,
    });

    // 5. Delegate to repository for atomic persistence & GiST double-booking check
    return await this.appointmentRepository.reschedule(data);
  }
}
