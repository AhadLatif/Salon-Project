import {
  branches,
  businessRolePermissions,
  businessRoles,
  type db,
  permissions,
  staffBranchAssignments,
  staffMembers,
} from '@salon/database';
import { OWNER_ROLE_NAME, ValidationError } from '@salon/shared';
import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import type {
  CreateRoleData,
  IRbacRepository,
  PermissionItem,
} from '../../application/ports/rbac-repository.port.js';
import { RoleEntity } from '../../domain/entities/role.entity.js';

export class RbacRepository implements IRbacRepository {
  constructor(private readonly database: typeof db) {}

  async getAllPermissions(): Promise<PermissionItem[]> {
    const rows = await this.database.select().from(permissions);
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      module: r.module,
      name: r.name,
      description: r.description,
    }));
  }

  async getBusinessRoles(businessId: string): Promise<RoleEntity[]> {
    const roleRows = await this.database
      .select()
      .from(businessRoles)
      .where(eq(businessRoles.businessId, businessId));

    if (roleRows.length === 0) return [];

    const roleIds = roleRows.map((r) => r.id);

    const rolePermRows = await this.database
      .select({
        roleId: businessRolePermissions.roleId,
        code: permissions.code,
      })
      .from(businessRolePermissions)
      .innerJoin(permissions, eq(businessRolePermissions.permissionId, permissions.id))
      .where(inArray(businessRolePermissions.roleId, roleIds));

    const rolePermMap = new Map<string, string[]>();
    for (const r of rolePermRows) {
      const existing = rolePermMap.get(r.roleId) ?? [];
      existing.push(r.code);
      rolePermMap.set(r.roleId, existing);
    }

    return roleRows.map(
      (r) =>
        new RoleEntity({
          id: r.id,
          businessId: r.businessId,
          name: r.name,
          description: r.description,
          isSystem: r.isSystem,
          displayOrder: r.displayOrder,
          permissions: rolePermMap.get(r.id) ?? [],
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }),
    );
  }

  async createCustomRole(data: CreateRoleData): Promise<RoleEntity> {
    return this.database.transaction(async (tx) => {
      const [newRole] = await tx
        .insert(businessRoles)
        .values({
          businessId: data.businessId,
          name: data.name,
          description: data.description,
          isSystem: false,
        })
        .returning();

      if (!newRole) {
        throw new Error('Failed to create role.');
      }

      const assignedPerms: string[] = [];

      if (data.permissionCodes && data.permissionCodes.length > 0) {
        const uniqueCodes = [...new Set(data.permissionCodes)];

        const matchingPerms = await tx
          .select({ id: permissions.id, code: permissions.code })
          .from(permissions)
          .where(inArray(permissions.code, uniqueCodes));

        if (matchingPerms.length !== uniqueCodes.length) {
          throw new ValidationError('Unknown permission codes provided.', {
            permissions: 'One or more provided permission codes are invalid.',
          });
        }

        if (matchingPerms.length > 0) {
          await tx.insert(businessRolePermissions).values(
            matchingPerms.map((p) => ({
              roleId: newRole.id,
              permissionId: p.id,
            })),
          );
          assignedPerms.push(...matchingPerms.map((p) => p.code));
        }
      }

      return new RoleEntity({
        id: newRole.id,
        businessId: newRole.businessId,
        name: newRole.name,
        description: newRole.description,
        isSystem: newRole.isSystem,
        displayOrder: newRole.displayOrder,
        permissions: assignedPerms,
        createdAt: newRole.createdAt,
        updatedAt: newRole.updatedAt,
      });
    });
  }

  async updateRolePermissions(
    roleId: string,
    businessId: string,
    permissionCodes: string[],
  ): Promise<RoleEntity | null> {
    return this.database.transaction(async (tx) => {
      const [role] = await tx
        .select()
        .from(businessRoles)
        .where(and(eq(businessRoles.id, roleId), eq(businessRoles.businessId, businessId)))
        .for('update')
        .limit(1);

      if (!role) return null;

      await tx.delete(businessRolePermissions).where(eq(businessRolePermissions.roleId, roleId));

      const assignedPerms: string[] = [];

      if (permissionCodes.length > 0) {
        const uniqueCodes = [...new Set(permissionCodes)];

        const matchingPerms = await tx
          .select({ id: permissions.id, code: permissions.code })
          .from(permissions)
          .where(inArray(permissions.code, uniqueCodes));

        if (matchingPerms.length !== uniqueCodes.length) {
          throw new ValidationError('Unknown permission codes provided.', {
            permissions: 'One or more provided permission codes are invalid.',
          });
        }

        if (matchingPerms.length > 0) {
          await tx.insert(businessRolePermissions).values(
            matchingPerms.map((p) => ({
              roleId: role.id,
              permissionId: p.id,
            })),
          );
          assignedPerms.push(...matchingPerms.map((p) => p.code));
        }
      }

      return new RoleEntity({
        id: role.id,
        businessId: role.businessId,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        displayOrder: role.displayOrder,
        permissions: assignedPerms,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      });
    });
  }

  async hasPermission(
    roleId: string,
    businessId: string,
    permissionCode: string,
  ): Promise<boolean> {
    const [role] = await this.database
      .select({
        isSystem: businessRoles.isSystem,
        name: businessRoles.name,
      })
      .from(businessRoles)
      .where(and(eq(businessRoles.id, roleId), eq(businessRoles.businessId, businessId)))
      .limit(1);

    if (!role) return false;

    if (role.isSystem && role.name === OWNER_ROLE_NAME) {
      return true;
    }

    const [match] = await this.database
      .select({ roleId: businessRolePermissions.roleId })
      .from(businessRolePermissions)
      .innerJoin(permissions, eq(businessRolePermissions.permissionId, permissions.id))
      .where(and(eq(businessRolePermissions.roleId, roleId), eq(permissions.code, permissionCode)))
      .limit(1);

    return !!match;
  }

  async hasBranchAccess(
    roleId: string,
    businessId: string,
    businessMemberId: string,
    branchId: string,
  ): Promise<boolean> {
    const [role] = await this.database
      .select({
        isSystem: businessRoles.isSystem,
        name: businessRoles.name,
      })
      .from(businessRoles)
      .where(and(eq(businessRoles.id, roleId), eq(businessRoles.businessId, businessId)))
      .limit(1);

    // Owners have implicit access to all branches, provided the branch belongs to the business
    if (role?.isSystem && role.name === OWNER_ROLE_NAME) {
      const [branch] = await this.database
        .select({ id: branches.id })
        .from(branches)
        .where(and(eq(branches.id, branchId), eq(branches.businessId, businessId)))
        .limit(1);

      if (branch) {
        return true;
      }
    }

    // Map businessMember to staffMember
    const [staff] = await this.database
      .select({ id: staffMembers.id })
      .from(staffMembers)
      .where(
        and(
          eq(staffMembers.businessId, businessId),
          eq(staffMembers.businessMemberId, businessMemberId),
          ne(staffMembers.status, 'terminated'),
        ),
      )
      .limit(1);

    if (!staff) return false;

    // Verify active branch assignment
    const [assignment] = await this.database
      .select({ id: staffBranchAssignments.id })
      .from(staffBranchAssignments)
      .where(
        and(
          eq(staffBranchAssignments.businessId, businessId),
          eq(staffBranchAssignments.staffMemberId, staff.id),
          eq(staffBranchAssignments.branchId, branchId),
          isNull(staffBranchAssignments.unassignedAt),
        ),
      )
      .limit(1);

    return !!assignment;
  }
}
