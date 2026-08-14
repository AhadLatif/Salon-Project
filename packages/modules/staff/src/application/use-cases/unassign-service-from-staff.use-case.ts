import { ResourceNotFoundError } from '@salon/shared';
import type { IStaffRepository } from '../ports/staff-repository.port.js';

export class UnassignServiceFromStaffUseCase {
  constructor(private readonly staffRepository: IStaffRepository) {}

  async execute(businessId: string, staffMemberId: string, serviceId: string): Promise<void> {
    const assignments = await this.staffRepository.getServiceAssignments(businessId, staffMemberId);
    if (!assignments.some((assignment) => assignment.serviceId === serviceId)) {
      throw new ResourceNotFoundError('Service is not assigned to this staff member');
    }

    const unassigned = await this.staffRepository.unassignService(
      businessId,
      staffMemberId,
      serviceId,
    );

    if (!unassigned) {
      throw new ResourceNotFoundError('Service is not assigned to this staff member');
    }
  }
}
