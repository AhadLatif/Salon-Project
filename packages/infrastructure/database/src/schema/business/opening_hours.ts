import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  smallint,
  text,
  time,
  uuid,
} from 'drizzle-orm/pg-core';
import { generateId, helperTimeStamp } from '../shared/index.js';
import { branches } from './branches.js';
import { businesses } from './businesses.js';

export const openingHours = pgTable(
  'opening_hours',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').notNull(),
    dayOfWeek: smallint('day_of_week').notNull(),
    shiftName: text('shift_name'),
    isClosed: boolean('is_closed').notNull().default(false),
    opensAt: time('opens_at', { withTimezone: false }),
    closesAt: time('closes_at', { withTimezone: false }),
    ...helperTimeStamp,
  },
  (table) => [
    index('idx_opening_hours_business').on(table.businessId),
    index('idx_opening_hours_branch').on(table.branchId),

    foreignKey({
      name: 'fk_opening_hours_branch_tenant',
      columns: [table.businessId, table.branchId],
      foreignColumns: [branches.businessId, branches.id],
    }).onDelete('cascade'),

    check('chk_opening_hours_day_of_week', sql`${table.dayOfWeek} BETWEEN 1 AND 7`),
    check('chk_opening_hours_time_order', sql`${table.opensAt} < ${table.closesAt}`),
    check(
      'chk_opening_hours_closed_day',
      sql`(
        (${table.isClosed} = TRUE AND ${table.opensAt} IS NULL AND ${table.closesAt} IS NULL)
        OR
        (${table.isClosed} = FALSE AND ${table.opensAt} IS NOT NULL AND ${table.closesAt} IS NOT NULL)
      )`,
    ),
  ],
);
