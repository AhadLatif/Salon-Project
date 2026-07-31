import { index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { users } from '../identity/users.js';
import { businessRoles } from './business_roles.js';

export const businessMembers = pgTable(
  'business_members',
  {
    id: uuid('id').primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    // References the user from the Identity module
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    // Note: restrict deletion so a role cannot be deleted if members are still assigned to it
    roleId: uuid('role_id')
      .notNull()
      .references(() => businessRoles.id, { onDelete: 'restrict' }),
    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('idx_business_members_business').on(table.businessId),
    index('idx_business_members_user').on(table.userId),
    index('idx_business_members_role').on(table.roleId),
    // A user can only be a member of a specific business once
    uniqueIndex('uq_business_user').on(table.businessId, table.userId),
  ],
);
