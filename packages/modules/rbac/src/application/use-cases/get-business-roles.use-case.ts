import type { RoleEntity } from '../../domain/entities/role.entity.js';
import type { IRbacRepository } from '../ports/rbac-repository.port.js';

export class GetBusinessRolesUseCase {
  constructor(private readonly rbacRepository: IRbacRepository) {}

  async execute(businessId: string): Promise<RoleEntity[]> {
    return this.rbacRepository.getBusinessRoles(businessId);
  }
}
