import { sql } from 'drizzle-orm';
import { check, index, pgTable, smallint, time, uuid } from 'drizzle-orm/pg-core';
import { generateId, helperTimeStamp } from '../shared/index.js';
import { staffWorkSchedules } from './staff_work_schedules.js';

export const staffScheduleShifts = pgTable(
  'staff_schedule_shifts',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    workScheduleId: uuid('work_schedule_id')
      .notNull()
      .references(() => staffWorkSchedules.id, { onDelete: 'cascade' }),

    dayOfWeek: smallint('day_of_week').notNull(), // 1 = Monday, 7 = Sunday

    // Time Without Time Zone (Wall-clock time)
    startsAt: time('starts_at', { withTimezone: false }).notNull(),
    endsAt: time('ends_at', { withTimezone: false }).notNull(),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_staff_shifts_schedule').on(table.workScheduleId),
    index('idx_staff_shifts_day').on(table.dayOfWeek),

    // Ensure day of week is valid
    check('chk_staff_shifts_day', sql`${table.dayOfWeek} BETWEEN 1 AND 7`),

    // Notice: NO starts_at < ends_at constraint here!
    // This allows night shifts (e.g. 22:00 to 02:00).
    // Overlapping shift validation will happen at the Application Orchestrator level.
  ],
);
