import { ForbiddenError } from '@salon/shared';
import type { StaffMemberEntity } from '../../domain/entities/staff-member.entity.js';
import type { CreateStaffMemberData, IStaffRepository } from '../ports/staff-repository.port.js';

export class CreateStaffMemberUseCase {
  constructor(private readonly staffRepository: IStaffRepository) {}

  async execute(data: CreateStaffMemberData): Promise<StaffMemberEntity> {
    // Cross-tenant IDOR guard: the businessMemberId must belong to THIS business
    const memberExists = await this.staffRepository.isBusinessMemberInBusiness(
      data.businessId,
      data.businessMemberId,
    );

    if (!memberExists) {
      throw new ForbiddenError(
        'Invalid business member ID or member does not belong to this business',
      );
    }

    return await this.staffRepository.create(data);
  }
}
