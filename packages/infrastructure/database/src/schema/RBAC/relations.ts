import { relations } from 'drizzle-orm';
import { businessMembers } from './business_members.js';
import { businessRolePermissions } from './business_role_permissions.js';
import { businessRoles } from './business_roles.js';
import { permissions } from './permissions.js';

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(businessRolePermissions),
}));

export const businessRolesRelations = relations(businessRoles, ({ many }) => ({
  // REMOVED: business: one(businesses), -> Cross-Module Violation
  permissions: many(businessRolePermissions),
  members: many(businessMembers),
}));

export const businessRolePermissionsRelations = relations(businessRolePermissions, ({ one }) => ({
  role: one(businessRoles, {
    fields: [businessRolePermissions.roleId],
    references: [businessRoles.id],
  }),
  permission: one(permissions, {
    fields: [businessRolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const businessMembersRelations = relations(businessMembers, ({ one }) => ({
  //  REMOVED: business: one(businesses), -> Cross-Module Violation
  role: one(businessRoles, {
    fields: [businessMembers.roleId],
    references: [businessRoles.id],
  }),
}));
