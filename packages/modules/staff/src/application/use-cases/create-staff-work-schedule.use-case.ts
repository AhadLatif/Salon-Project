import { ResourceNotFoundError } from '@salon/shared';
import type { IStaffRepository, StaffWorkSchedule } from '../ports/staff-repository.port.js';

export interface CreateWorkScheduleData {
  recurrencePattern: 'weekly' | 'biweekly' | 'triweekly' | 'four_weekly';
  effectiveFrom: string;
  effectiveUntil?: string | null | undefined;
}

export class CreateStaffWorkScheduleUseCase {
  constructor(private readonly staffRepository: IStaffRepository) {}

  async execute(
    businessId: string,
    staffMemberId: string,
    data: CreateWorkScheduleData,
  ): Promise<StaffWorkSchedule> {
    // Staff member must exist in this business
    const staff = await this.staffRepository.findById(businessId, staffMemberId);
    if (!staff) {
      throw new ResourceNotFoundError('Staff member not found');
    }

    return await this.staffRepository.createWorkSchedule(businessId, staffMemberId, data);
  }
}
