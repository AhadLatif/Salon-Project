import type { StaffMemberEntity } from '../../domain/entities/staff-member.entity.js';
import type { IStaffRepository } from '../ports/staff-repository.port.js';

export class GetStaffMembersUseCase {
  constructor(private readonly staffRepository: IStaffRepository) {}

  async execute(businessId: string): Promise<StaffMemberEntity[]> {
    return await this.staffRepository.findAllByBusinessId(businessId);
  }
}
