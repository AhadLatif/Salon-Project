import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { businessMembers } from '../RBAC/business_members.js';
import { generateId, helperTimeStamp } from '../shared/index.js';
import { staffMembers } from './staff_members.js';

export const timeOffReasonEnum = pgEnum('time_off_reason', [
  'vacation',
  'sick_leave',
  'personal_leave',
  'training',
  'unavailable',
  'other',
]);

export const staffTimeOff = pgTable(
  'staff_time_off',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),

    staffMemberId: uuid('staff_member_id').notNull(),

    reason: timeOffReasonEnum('reason').notNull().default('unavailable'),

    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true, mode: 'date' }).notNull(),

    notes: text('notes'),

    // Who approved this time off?
    approvedBy: uuid('approved_by').references(() => businessMembers.id, { onDelete: 'set null' }),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_staff_time_off_staff').on(table.staffMemberId),
    index('idx_staff_time_off_dates').on(table.startsAt, table.endsAt),

    foreignKey({
      name: 'fk_staff_time_off_staff_tenant',
      columns: [table.businessId, table.staffMemberId],
      foreignColumns: [staffMembers.businessId, staffMembers.id],
    }).onDelete('cascade'),

    // Time off must end after it starts
    check('chk_staff_time_off_dates', sql`${table.startsAt} < ${table.endsAt}`),
  ],
);
