import { ConflictError } from '@salon/shared';
import {
  utcToZonedDateString,
  utcToZonedDayOfWeek,
  utcToZonedTimeString,
  zonedTimeToUtc,
} from '../../domain/services/availability-calculator.js';
import type {
  IBranchValidator,
  IServiceValidator,
  IStaffValidator,
} from '../ports/appointment-validators.port.js';

export interface AssertBookableSegment {
  serviceId: string;
  staffMemberId: string;
  startsAt: Date;
  endsAt: Date;
}

export interface AssertBookableInput {
  businessId: string;
  branchId: string;
  bookingChannel: 'marketplace' | 'business_dashboard' | 'walk_in';
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  segments: AssertBookableSegment[];
}

/**
 * Shared application guard that validates appointment scheduling preconditions:
 * 1. Per-branch service bookability (all channels).
 * 2. Branch operating hours (marketplace channel).
 * 3. Staff shift availability (marketplace channel).
 * 4. Staff approved time-off (all channels, using exact branch-local UTC bounds).
 */
export class AppointmentAvailabilityGuard {
  constructor(
    private readonly branchValidator: IBranchValidator,
    private readonly staffValidator: IStaffValidator,
    private readonly serviceValidator: IServiceValidator,
  ) {}

  async assertBookable(input: AssertBookableInput): Promise<void> {
    // ── 0. Validate staff eligibility at the target branch ───────────────
    const uniqueStaffIds = Array.from(new Set(input.segments.map((s) => s.staffMemberId)));
    await Promise.all(
      uniqueStaffIds.map(async (staffMemberId) => {
        const isAssigned = await this.staffValidator.hasStaffBranchAssignment(
          input.businessId,
          staffMemberId,
          input.branchId,
        );
        if (!isAssigned) {
          throw new ConflictError(
            `Staff member ${staffMemberId} is not assigned to branch ${input.branchId}.`,
          );
        }
      }),
    );

    // ── 1. Validate service bookability at the target branch ───────────────
    const uniqueServiceIds = Array.from(new Set(input.segments.map((s) => s.serviceId)));
    await Promise.all(
      uniqueServiceIds.map(async (serviceId) => {
        const isBookable = await this.serviceValidator.isServiceBookableAtBranch(
          input.businessId,
          serviceId,
          input.branchId,
        );
        if (!isBookable) {
          throw new ConflictError(
            `Service ${serviceId} is not bookable at branch ${input.branchId}.`,
          );
        }
      }),
    );

    // ── 2. Resolve branch timezone and operating hours ──────────────────────
    const initialJsDay = input.scheduledStartAt.getUTCDay();
    const initialDayOfWeek = initialJsDay === 0 ? 7 : initialJsDay;

    const initialBranchHours = await this.branchValidator.getBranchOpeningHoursForDay(
      input.businessId,
      input.branchId,
      initialDayOfWeek,
    );
    const branchTz = initialBranchHours?.timezone ?? 'UTC';

    const dateStr = utcToZonedDateString(input.scheduledStartAt, branchTz);
    const dayOfWeek = utcToZonedDayOfWeek(input.scheduledStartAt, branchTz);

    const branchHours =
      dayOfWeek === initialDayOfWeek
        ? initialBranchHours
        : await this.branchValidator.getBranchOpeningHoursForDay(
            input.businessId,
            input.branchId,
            dayOfWeek,
          );

    // Exact branch-local day bounds in UTC for time-off evaluation
    const dayStartUtc = zonedTimeToUtc(dateStr, '00:00:00', branchTz);

    // Exclusive boundary: Next branch-local date at 00:00:00
    const nextLocalMs = Date.parse(`${dateStr}T00:00:00.000Z`) + 86_400_000;
    const nextDateStr = new Date(nextLocalMs).toISOString().split('T')[0];
    // biome-ignore lint/style/noNonNullAssertion: split guaranteed to have index 0
    const dayEndUtc = zonedTimeToUtc(nextDateStr!, '00:00:00', branchTz);

    // ── 3. Branch operating hours enforcement (marketplace only) ───────────
    if (input.bookingChannel === 'marketplace') {
      if (!branchHours || branchHours.isClosed || !branchHours.opensAt || !branchHours.closesAt) {
        throw new ConflictError('Cannot book appointment: branch is closed on the selected date.');
      }

      const branchOpenUtc = zonedTimeToUtc(dateStr, branchHours.opensAt, branchTz);
      const branchCloseUtc = zonedTimeToUtc(dateStr, branchHours.closesAt, branchTz);

      if (input.scheduledStartAt < branchOpenUtc || input.scheduledEndAt > branchCloseUtc) {
        throw new ConflictError(
          `Cannot book appointment: appointment time falls outside branch operating hours (${branchHours.opensAt}-${branchHours.closesAt}).`,
        );
      }
    }

    // ── 4. Staff shift and approved time-off enforcement ────────────────────
    // Parallelize queries to eliminate sequential N+1 network round-trips
    const scheduleCandidatesList = await Promise.all(
      input.segments.map(async (seg) => {
        const candidates = await this.staffValidator.getStaffAvailabilitySchedule(
          input.businessId,
          {
            branchId: input.branchId,
            serviceId: seg.serviceId,
            date: dateStr,
            dayOfWeek,
            staffMemberId: seg.staffMemberId,
            dayStartUtc,
            dayEndUtc,
          },
        );
        return { seg, candidates };
      }),
    );

    for (const { seg, candidates } of scheduleCandidatesList) {
      const candidate = candidates.find((c) => c.staffMemberId === seg.staffMemberId);

      // Enforce working shift for marketplace bookings
      if (input.bookingChannel === 'marketplace') {
        if (!candidate) {
          throw new ConflictError(
            `Staff member ${seg.staffMemberId} is not scheduled to work at the selected time.`,
          );
        }
        const segStartStr = utcToZonedTimeString(seg.startsAt, branchTz);
        const segEndStr = utcToZonedTimeString(seg.endsAt, branchTz);
        const hasShift = candidate.shifts.some(
          (shift) => segStartStr >= shift.startsAt && segEndStr <= shift.endsAt,
        );
        if (!hasShift) {
          throw new ConflictError(
            `Staff member ${seg.staffMemberId} is not scheduled to work at the selected time.`,
          );
        }
      }

      // Time-off is strictly enforced for all channels
      if (candidate) {
        const hasTimeOff = candidate.timeOff.some(
          (to) => seg.startsAt < to.endsAt && seg.endsAt > to.startsAt,
        );
        if (hasTimeOff) {
          throw new ConflictError(
            `Staff member ${seg.staffMemberId} has approved time off during the requested slot.`,
          );
        }
      }
    }
  }
}
