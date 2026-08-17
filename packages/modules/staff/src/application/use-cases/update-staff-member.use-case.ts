import { ResourceNotFoundError } from '@salon/shared';
import type { StaffMemberEntity } from '../../domain/entities/staff-member.entity.js';
import type { IStaffRepository, UpdateStaffMemberData } from '../ports/staff-repository.port.js';

export class UpdateStaffMemberUseCase {
  constructor(private readonly staffRepository: IStaffRepository) {}

  async execute(
    businessId: string,
    staffMemberId: string,
    data: UpdateStaffMemberData,
  ): Promise<StaffMemberEntity> {
    const existingStaff = await this.staffRepository.findById(businessId, staffMemberId);
    if (!existingStaff) {
      throw new ResourceNotFoundError('Staff member not found');
    }

    const staff = await this.staffRepository.update(businessId, staffMemberId, data);

    if (!staff) {
      throw new ResourceNotFoundError('Staff member not found');
    }

    return staff;
  }
}
