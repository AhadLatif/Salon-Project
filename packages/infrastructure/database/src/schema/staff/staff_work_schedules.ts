import { sql } from 'drizzle-orm';
import { check, date, foreignKey, index, pgEnum, pgTable, uuid } from 'drizzle-orm/pg-core';
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

    recurrencePattern: scheduleRecurrenceEnum('recurrence_pattern').notNull().default('weekly'),

    effectiveFrom: date('effective_from').notNull(),
    effectiveUntil: date('effective_until'), // NULL means it runs forever until superseded

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_staff_schedules_staff').on(table.staffMemberId),

    foreignKey({
      name: 'fk_staff_work_schedule_staff_tenant',
      columns: [table.businessId, table.staffMemberId],
      foreignColumns: [staffMembers.businessId, staffMembers.id],
    }).onDelete('cascade'),

    // Ensure chronological sanity
    check(
      'chk_work_schedule_dates',
      sql`${table.effectiveUntil} IS NULL OR ${table.effectiveFrom} <= ${table.effectiveUntil}`,
    ),
  ],
);
