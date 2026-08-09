import {
  foreignKey,
  index,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { users } from '../identity/users.js';
import { generateId, helperTimeStamp } from '../shared/index.js';
import { businessRoles } from './business_roles.js';

export const businessMembers = pgTable(
  'business_members',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    //  Cross-Module FK via String (No imports needed!)
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),

    // Cross-Module FK via String (No imports needed!)
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Intra-Module FK (Safe to import and use directly)
    roleId: uuid('role_id').notNull(),

    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    ...helperTimeStamp,
  },
  (table) => [
    index('idx_business_members_business').on(table.businessId),
    index('idx_business_members_user').on(table.userId),
    index('idx_business_members_role').on(table.roleId),
    uniqueIndex('uq_business_user').on(table.businessId, table.userId),
    unique('uq_bus_members_tenant_id').on(table.businessId, table.id),

    foreignKey({
      name: 'fk_business_member_role_tenant',
      columns: [table.businessId, table.roleId],
      foreignColumns: [businessRoles.businessId, businessRoles.id],
    }).onDelete('restrict'),
  ],
);
