import { ResourceNotFoundError } from '@salon/shared';
import type {
  IStaffRepository,
  StaffScheduleShift,
  StaffWorkSchedule,
} from '../ports/staff-repository.port.js';

export class GetStaffWorkSchedulesUseCase {
  constructor(private readonly staffRepository: IStaffRepository) {}

  async execute(
    businessId: string,
    staffMemberId: string,
  ): Promise<(StaffWorkSchedule & { shifts: StaffScheduleShift[] })[]> {
    const staff = await this.staffRepository.findById(businessId, staffMemberId);
    if (!staff) {
      throw new ResourceNotFoundError('Staff member not found');
    }

    return await this.staffRepository.getWorkSchedules(businessId, staffMemberId);
  }
}
