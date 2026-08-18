import type { RoleEntity } from '../../domain/entities/role.entity.js';

export interface PermissionItem {
  id: string;
  code: string;
  module: string;
  name: string;
  description: string | null;
}

export interface CreateRoleData {
  businessId: string;
  name: string;
  description?: string | null | undefined;
  permissionCodes?: string[] | undefined;
}

export interface IRbacRepository {
  getAllPermissions(): Promise<PermissionItem[]>;
  getBusinessRoles(businessId: string): Promise<RoleEntity[]>;
  createCustomRole(data: CreateRoleData): Promise<RoleEntity>;
  updateRolePermissions(
    roleId: string,
    businessId: string,
    permissionCodes: string[],
  ): Promise<RoleEntity | null>;
  hasPermission(roleId: string, businessId: string, permissionCode: string): Promise<boolean>;
  hasBranchAccess(
    roleId: string,
    businessId: string,
    businessMemberId: string,
    branchId: string,
  ): Promise<boolean>;
}
