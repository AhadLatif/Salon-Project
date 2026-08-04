import { index, jsonb, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { users } from '../identity/users.js';
import { generateId, helperTimeStamp } from '../shared/index.js';

export const notificationPriorityEnum = pgEnum('notification_priority', [
  'LOW',
  'NORMAL',
  'HIGH',
  'CRITICAL',
]);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    // The B2C or B2B User receiving the message
    recipientUserId: uuid('recipient_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    // The Tenant that triggered it (Nullable for platform-wide alerts)
    businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'cascade' }),

    eventKey: varchar('event_key', { length: 150 }).notNull(),
    payload: jsonb('payload').notNull(),

    priority: notificationPriorityEnum('priority').notNull().default('NORMAL'),

    scheduledFor: timestamp('scheduled_for', { withTimezone: true, mode: 'date' }),

    // createdAt acts as the creation timestamp
    ...helperTimeStamp,
  },
  (table) => [
    index('idx_notifications_recipient').on(table.recipientUserId),
    index('idx_notifications_business').on(table.businessId), // For billing/auditing queries
    index('idx_notifications_event').on(table.eventKey),
    index('idx_notifications_schedule').on(table.scheduledFor),
    index('idx_notifications_created_at').on(table.createdAt),
  ],
);
