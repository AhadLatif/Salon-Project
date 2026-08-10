import { ResourceNotFoundError } from '@salon/shared';
import type { RoleEntity } from '../../domain/entities/role.entity.js';
import type { IRbacRepository } from '../ports/rbac-repository.port.js';

export class UpdateRolePermissionsUseCase {
  constructor(private readonly rbacRepository: IRbacRepository) {}

  async execute(
    roleId: string,
    businessId: string,
    permissionCodes: string[],
  ): Promise<RoleEntity> {
    const updatedRole = await this.rbacRepository.updateRolePermissions(
      roleId,
      businessId,
      permissionCodes,
    );

    if (!updatedRole) {
      throw new ResourceNotFoundError('Role not found or does not belong to this business.');
    }

    return updatedRole;
  }
}
