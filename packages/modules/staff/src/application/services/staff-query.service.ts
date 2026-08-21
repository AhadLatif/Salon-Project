import type { IStaffRepository } from '../ports/staff-repository.port.js';

export interface IStaffQueryService {
  hasStaffBranchAssignment(
    businessId: string,
    businessMemberId: string,
    branchId: string,
  ): Promise<boolean>;
}

/**
 * Service providing cross-module staff and scheduling queries.
 * Encapsulates staff profile lookups, branch assignments, and shift availability.
 */
export class StaffQueryService implements IStaffQueryService {
  constructor(private readonly staffRepository: IStaffRepository) {}

  /**
   * Verifies that a business member has an active staff profile assigned to the branch.
   */
  async hasStaffBranchAssignment(
    businessId: string,
    businessMemberId: string,
    branchId: string,
  ): Promise<boolean> {
    return await this.staffRepository.hasStaffBranchAssignment(
      businessId,
      businessMemberId,
      branchId,
    );
  }
}
