import { ResourceNotFoundError } from '@salon/shared';
import {
  type AvailableSlot,
  computeAvailableSlots,
  type TimeInterval,
  zonedTimeToUtc,
} from '../../domain/services/availability-calculator.js';
import type {
  GetAvailabilityData,
  IAppointmentRepository,
  OccupiedAllocationInterval,
} from '../ports/appointment-repository.port.js';
import type {
  IBranchValidator,
  IServiceValidator,
  IStaffValidator,
} from '../ports/appointment-validators.port.js';

export class GetAvailabilityUseCase {
  constructor(
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly branchValidator: IBranchValidator,
    private readonly serviceValidator: IServiceValidator,
    private readonly staffValidator: IStaffValidator,
  ) {}

  async execute(data: GetAvailabilityData): Promise<AvailableSlot[]> {
    // 1. Fetch and validate service
    const service = await this.serviceValidator.getServiceDetails(data.businessId, data.serviceId);
    if (!service?.isActive) {
      throw new ResourceNotFoundError(`Service ${data.serviceId} not found in this business`);
    }

    // 2. Determine day of week for the target date (1 = Monday ... 7 = Sunday)
    const dateObj = new Date(`${data.date}T12:00:00.000Z`);
    const jsDay = dateObj.getUTCDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;

    // 3. Query branch opening hours from branch module
    const branchHours = await this.branchValidator.getBranchOpeningHoursForDay(
      data.businessId,
      data.branchId,
      dayOfWeek,
    );

    if (!branchHours || branchHours.isClosed || !branchHours.opensAt || !branchHours.closesAt) {
      return []; // Branch is closed on this day
    }

    const branchTz = branchHours.timezone ?? 'UTC';

    // Compute branch-local day bounds once for both time-off filtering and allocation queries.
    // Using branch timezone here closes the UTC-anchored day boundary bug (Finding 9).
    const dayStart = zonedTimeToUtc(data.date, '00:00:00', branchTz);
    const dayEnd = new Date(zonedTimeToUtc(data.date, '23:59:59', branchTz).getTime() + 999);

    // 4. Query eligible candidate staff, shifts, and time off from staff module
    const candidates = await this.staffValidator.getStaffAvailabilitySchedule(data.businessId, {
      branchId: data.branchId,
      serviceId: data.serviceId,
      date: data.date,
      dayOfWeek,
      dayStartUtc: dayStart,
      dayEndUtc: dayEnd,
      ...(data.staffMemberId ? { staffMemberId: data.staffMemberId } : {}),
    });

    if (candidates.length === 0) {
      return [];
    }

    // 5. Query occupied allocations for candidate staff on this date from appointment repository
    const candidateStaffIds = candidates.map((c) => c.staffMemberId);

    const occupiedAllocations = await this.appointmentRepository.findOccupiedAllocations(
      data.businessId,
      candidateStaffIds,
      dayStart,
      dayEnd,
    );

    const allocationsByStaff = new Map<string, OccupiedAllocationInterval[]>();
    for (const alloc of occupiedAllocations) {
      const list = allocationsByStaff.get(alloc.staffMemberId) ?? [];
      list.push(alloc);
      allocationsByStaff.set(alloc.staffMemberId, list);
    }

    const allSlots: AvailableSlot[] = [];

    // 6. Compute available slots for each candidate staff member
    for (const candidate of candidates) {
      const durationMinutes = candidate.overrideDurationMinutes ?? service.defaultDurationMinutes;

      // Intersect candidate's shifts with branch opening hours
      const workingIntervals: TimeInterval[] = [];
      for (const shift of candidate.shifts) {
        const effectiveStart =
          shift.startsAt > branchHours.opensAt ? shift.startsAt : branchHours.opensAt;
        const effectiveEnd =
          shift.endsAt < branchHours.closesAt ? shift.endsAt : branchHours.closesAt;

        if (effectiveStart < effectiveEnd) {
          workingIntervals.push({
            start: zonedTimeToUtc(data.date, effectiveStart, branchTz),
            end: zonedTimeToUtc(data.date, effectiveEnd, branchTz),
          });
        }
      }

      if (workingIntervals.length === 0) {
        continue;
      }

      // Collect busy periods: approved time-off + active appointment allocations
      const busyIntervals: TimeInterval[] = candidate.timeOff.map((to) => ({
        start: to.startsAt,
        end: to.endsAt,
      }));

      const staffAllocations = allocationsByStaff.get(candidate.staffMemberId) ?? [];
      for (const alloc of staffAllocations) {
        busyIntervals.push({
          start: alloc.occupiedStart,
          end: alloc.occupiedEnd,
        });
      }

      const slots = computeAvailableSlots({
        staffMemberId: candidate.staffMemberId,
        workingIntervals,
        busyIntervals,
        durationMinutes,
        bufferBeforeMinutes: service.bufferBeforeMinutes,
        bufferAfterMinutes: service.bufferAfterMinutes,
      });

      allSlots.push(...slots);
    }

    allSlots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    return allSlots;
  }
}
