import { ResourceNotFoundError } from '@salon/shared';
import type { StaffMemberEntity } from '../../domain/entities/staff-member.entity.js';
import type { IStaffRepository } from '../ports/staff-repository.port.js';

export class GetStaffMemberByIdUseCase {
  constructor(private readonly staffRepository: IStaffRepository) {}

  async execute(businessId: string, staffMemberId: string): Promise<StaffMemberEntity> {
    const staff = await this.staffRepository.findById(businessId, staffMemberId);

    if (!staff) {
      throw new ResourceNotFoundError('Staff member not found');
    }

    return staff;
  }
}
