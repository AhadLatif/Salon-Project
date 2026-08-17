import { ResourceNotFoundError } from '@salon/shared';
import type { IStaffRepository } from '../ports/staff-repository.port.js';

export class DeactivateStaffMemberUseCase {
  constructor(private readonly staffRepository: IStaffRepository) {}

  async execute(businessId: string, staffMemberId: string): Promise<void> {
    const staff = await this.staffRepository.findById(businessId, staffMemberId);
    if (!staff) {
      throw new ResourceNotFoundError('Staff member not found');
    }

    const deactivated = await this.staffRepository.deactivate(businessId, staffMemberId);

    if (!deactivated) {
      throw new ResourceNotFoundError('Staff member not found');
    }
  }
}
