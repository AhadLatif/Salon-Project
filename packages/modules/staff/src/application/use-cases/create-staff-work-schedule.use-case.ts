import { ResourceNotFoundError, ValidationError } from '@salon/shared';
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
    branchId: string,
    data: CreateWorkScheduleData,
  ): Promise<StaffWorkSchedule> {
    // Staff member must exist in this business
    const staff = await this.staffRepository.findById(businessId, staffMemberId);
    if (!staff) {
      throw new ResourceNotFoundError('Staff member not found');
    }

    // SECURITY: Verify the branch belongs to this business tenant to prevent IDOR
    const branchExists = await this.staffRepository.isBranchInBusiness(businessId, branchId);
    if (!branchExists) {
      throw new ResourceNotFoundError('Branch not found in this business');
    }

    if (data.effectiveUntil && new Date(data.effectiveUntil) < new Date(data.effectiveFrom)) {
      throw new ValidationError('effectiveUntil cannot be earlier than effectiveFrom', {
        effectiveUntil: 'Must be strictly after or equal to effectiveFrom',
      });
    }

    const schedules = await this.staffRepository.getWorkSchedules(
      businessId,
      staffMemberId,
      branchId,
    );
    const openSchedule = schedules.find(
      (s) => s.effectiveUntil === null && s.branchId === branchId,
    );
    if (openSchedule && new Date(data.effectiveFrom) < new Date(openSchedule.effectiveFrom)) {
      throw new ValidationError(
        'effectiveFrom cannot be earlier than the currently open schedule start date',
        {
          effectiveFrom: 'Must be strictly after or equal to the current schedule start date',
        },
      );
    }

    return await this.staffRepository.createWorkSchedule(businessId, staffMemberId, branchId, data);
  }
}
