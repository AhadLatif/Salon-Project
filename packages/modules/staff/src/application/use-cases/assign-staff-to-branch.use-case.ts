import { ForbiddenError, ResourceNotFoundError } from '@salon/shared';
import type { IStaffRepository, StaffBranchAssignment } from '../ports/staff-repository.port.js';

export class AssignStaffToBranchUseCase {
  constructor(private readonly staffRepository: IStaffRepository) {}

  async execute(
    businessId: string,
    staffMemberId: string,
    branchId: string,
    isPrimary = false,
  ): Promise<StaffBranchAssignment> {
    // 1. Staff member must exist in this business
    const staff = await this.staffRepository.findById(businessId, staffMemberId);
    if (!staff) {
      throw new ResourceNotFoundError('Staff member not found');
    }

    // 2. Cross-tenant branch guard: branchId must belong to this business and not be archived
    const branchValid = await this.staffRepository.isBranchInBusiness(businessId, branchId);
    if (!branchValid) {
      throw new ForbiddenError('Invalid branch ID or branch does not belong to this business');
    }

    return await this.staffRepository.assignToBranch(
      businessId,
      staffMemberId,
      branchId,
      isPrimary,
    );
  }
}
