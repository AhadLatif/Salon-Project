import type { RoleEntity } from '../../domain/entities/role.entity.js';
import type { CreateRoleData, IRbacRepository } from '../ports/rbac-repository.port.js';

export class CreateCustomRoleUseCase {
  constructor(private readonly rbacRepository: IRbacRepository) {}

  async execute(data: CreateRoleData): Promise<RoleEntity> {
    return this.rbacRepository.createCustomRole(data);
  }
}
