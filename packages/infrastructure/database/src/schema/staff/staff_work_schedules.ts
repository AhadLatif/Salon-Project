import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { branches } from '../business/branches.js';
import { businesses } from '../business/businesses.js';
import { generateId, helperTimeStamp } from '../shared/index.js';
import { staffMembers } from './staff_members.js';

export const scheduleRecurrenceEnum = pgEnum('schedule_recurrence', [
  'weekly',
  'biweekly',
  'triweekly',
  'four_weekly',
]);

export const staffWorkSchedules = pgTable(
  'staff_work_schedules',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),

    staffMemberId: uuid('staff_member_id').notNull(),
    branchId: uuid('branch_id').notNull(),

    recurrencePattern: scheduleRecurrenceEnum('recurrence_pattern').notNull().default('weekly'),

    effectiveFrom: date('effective_from').notNull(),
    effectiveUntil: date('effective_until'), // NULL means it runs forever until superseded

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_staff_schedules_staff').on(table.staffMemberId),

    // Enforce that the staffMember belongs to the same business tenant
    foreignKey({
      name: 'fk_staff_work_schedule_staff_tenant',
      columns: [table.businessId, table.staffMemberId],
      foreignColumns: [staffMembers.businessId, staffMembers.id],
    }).onDelete('cascade'),

    // Enforce that the branch belongs to the same business tenant (branch-level scoping)
    foreignKey({
      name: 'fk_staff_work_schedule_branch_tenant',
      columns: [table.businessId, table.branchId],
      foreignColumns: [branches.businessId, branches.id],
    }).onDelete('restrict'),

    // Ensure chronological sanity
    check(
      'chk_work_schedule_dates',
      sql`${table.effectiveUntil} IS NULL OR ${table.effectiveFrom} <= ${table.effectiveUntil}`,
    ),

    // Ensure one open schedule per staff member per branch
    uniqueIndex('uq_staff_work_schedule_staff_branch')
      .on(table.staffMemberId, table.branchId)
      .where(sql`${table.effectiveUntil} IS NULL`),
  ],
);
