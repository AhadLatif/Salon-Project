import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { branches } from '../business/branches.js';
import { businesses } from '../business/businesses.js';
import { generateId, helperTimeStamp } from '../shared/index.js';
import { staffMembers } from './staff_members.js';

export const staffBranchAssignments = pgTable(
  'staff_branch_assignments',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),

    staffMemberId: uuid('staff_member_id').notNull(),

    branchId: uuid('branch_id').notNull(),

    isPrimary: boolean('is_primary').notNull().default(false),

    assignedAt: timestamp('assigned_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),

    // When they stop working at this branch (retains history)
    unassignedAt: timestamp('unassigned_at', { withTimezone: true, mode: 'date' }),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_staff_branch_assign_staff').on(table.staffMemberId),
    index('idx_staff_branch_assign_branch').on(table.branchId),

    foreignKey({
      name: 'fk_staff_branch_assignment_staff_tenant',
      columns: [table.businessId, table.staffMemberId],
      foreignColumns: [staffMembers.businessId, staffMembers.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'fk_staff_branch_assignment_branch_tenant',
      columns: [table.businessId, table.branchId],
      foreignColumns: [branches.businessId, branches.id],
    }).onDelete('restrict'),

    // A staff member can only have ONE active primary branch at any given time
    uniqueIndex('uq_staff_primary_branch')
      .on(table.staffMemberId)
      .where(sql`${table.isPrimary} = TRUE AND ${table.unassignedAt} IS NULL`),
  ],
);
