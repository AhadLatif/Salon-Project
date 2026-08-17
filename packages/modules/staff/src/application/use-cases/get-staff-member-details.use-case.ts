import { ResourceNotFoundError } from '@salon/shared';
import type { IStaffRepository, StaffMemberWithRelations } from '../ports/staff-repository.port.js';

export class GetStaffMemberDetailsUseCase {
  constructor(private readonly staffRepository: IStaffRepository) {}

  async execute(businessId: string, staffMemberId: string): Promise<StaffMemberWithRelations> {
    const staff = await this.staffRepository.findById(businessId, staffMemberId);

    if (!staff) {
      throw new ResourceNotFoundError('Staff member not found');
    }

    // Fetch all relations in parallel for a single detailed response
    const [branchAssignments, serviceAssignments, workSchedules] = await Promise.all([
      this.staffRepository.getBranchAssignments(businessId, staffMemberId),
      this.staffRepository.getServiceAssignments(businessId, staffMemberId),
      this.staffRepository.getWorkSchedules(businessId, staffMemberId),
    ]);

    return {
      ...staff,
      branchAssignments,
      serviceAssignments,
      workSchedules,
    };
  }
}
