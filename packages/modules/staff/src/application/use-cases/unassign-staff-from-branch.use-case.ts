import { ResourceNotFoundError } from '@salon/shared';
import type { IStaffRepository } from '../ports/staff-repository.port.js';

export class UnassignStaffFromBranchUseCase {
  constructor(private readonly staffRepository: IStaffRepository) {}

  async execute(businessId: string, staffMemberId: string, branchId: string): Promise<void> {
    const assignments = await this.staffRepository.getBranchAssignments(businessId, staffMemberId);
    const isAssigned = assignments.some(
      (assignment) => assignment.branchId === branchId && assignment.unassignedAt === null,
    );
    if (!isAssigned) {
      throw new ResourceNotFoundError('Staff member is not assigned to this branch');
    }

    const unassigned = await this.staffRepository.unassignFromBranch(
      businessId,
      staffMemberId,
      branchId,
    );

    if (!unassigned) {
      throw new ResourceNotFoundError('Staff member is not assigned to this branch');
    }
  }
}
