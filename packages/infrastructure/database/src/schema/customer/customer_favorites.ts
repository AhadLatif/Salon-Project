// packages/infrastructure/database/src/schema/customer_favorites.ts

import { sql } from 'drizzle-orm';
import { check, index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { users } from '../identity/users.js';
import { generateId } from '../shared/index.js';
import { staffMembers } from '../staff/staff_members.js';

export const customerFavorites = pgTable(
  'customer_favorites',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    // The Global B2C User who clicked the "Heart" icon
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // What did they favorite? (A salon, or a specific barber?)
    // Note: We don't use composite keys here because the User is global, not tenant-bound.
    businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'cascade' }),
    staffMemberId: uuid('staff_member_id').references(() => staffMembers.id, {
      onDelete: 'cascade',
    }),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_favorites_user').on(table.userId),
    index('idx_favorites_business').on(table.businessId),
    index('idx_favorites_staff').on(table.staffMemberId),

    check(
      'chk_favorites_target',
      sql`${table.businessId} IS NOT NULL OR ${table.staffMemberId} IS NOT NULL`,
    ),

    uniqueIndex('uq_favorites_user_business')
      .on(table.userId, table.businessId)
      .where(sql`${table.businessId} IS NOT NULL`),

    uniqueIndex('uq_favorites_user_staff')
      .on(table.userId, table.staffMemberId)
      .where(sql`${table.staffMemberId} IS NOT NULL`),
  ],
);
