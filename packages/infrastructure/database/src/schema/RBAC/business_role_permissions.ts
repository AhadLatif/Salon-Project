import { pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { businessRoles } from './business_roles.js';
import { permissions } from './permissions.js';

export const businessRolePermissions = pgTable(
  'business_role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => businessRoles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    // Composite Primary Key: A role cannot have the same permission assigned twice
    primaryKey({ columns: [table.roleId, table.permissionId] }),
  ],
);
