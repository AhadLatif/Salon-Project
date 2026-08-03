import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from '../identity/users.js';
import { generateId, helperTimeStamp } from '../shared/index.js';

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventKey: varchar('event_key', { length: 150 }).notNull(),

    emailEnabled: boolean('email_enabled').notNull().default(true),
    smsEnabled: boolean('sms_enabled').notNull().default(true),
    pushEnabled: boolean('push_enabled').notNull().default(true),
    inAppEnabled: boolean('in_app_enabled').notNull().default(true),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_notif_pref_user').on(table.userId),
    index('idx_notif_pref_event').on(table.eventKey),

    // A user can only have one preference rule per event type
    uniqueIndex('uq_notif_preference').on(table.userId, table.eventKey),

    // Must enable at least one channel, otherwise the record should just be deleted
    check(
      'chk_notif_pref_at_least_one',
      sql`${table.emailEnabled} OR ${table.smsEnabled} OR ${table.pushEnabled} OR ${table.inAppEnabled}`,
    ),
  ],
);
