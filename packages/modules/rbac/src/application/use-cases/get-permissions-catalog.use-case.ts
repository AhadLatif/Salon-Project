import type { IRbacRepository, PermissionItem } from '../ports/rbac-repository.port.js';

export class GetPermissionsCatalogUseCase {
  constructor(private readonly rbacRepository: IRbacRepository) {}

  async execute(): Promise<PermissionItem[]> {
    return this.rbacRepository.getAllPermissions();
  }
}
