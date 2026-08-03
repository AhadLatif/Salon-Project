import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { generateId, helperTimeStamp } from '../shared/index.js';
import { notifications } from './notifications.js';

export const notificationChannelEnum = pgEnum('notification_channel', [
  'EMAIL',
  'SMS',
  'PUSH',
  'IN_APP',
]);
export const deliveryStatusEnum = pgEnum('delivery_status', [
  'PENDING',
  'PROCESSING',
  'SENT',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
]);

export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),

    // Cascaded Tenant Boundary for high-speed billing queries (e.g. "Count all DELIVERED SMS for Business X")
    businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'cascade' }),

    channel: notificationChannelEnum('channel').notNull(),
    status: deliveryStatusEnum('status').notNull().default('PENDING'),

    providerName: varchar('provider_name', { length: 100 }), // e.g., 'twilio', 'sendgrid'
    providerMessageId: varchar('provider_message_id', { length: 255 }),

    attemptNumber: integer('attempt_number').notNull().default(1),

    errorCode: varchar('error_code', { length: 100 }),
    errorMessage: text('error_message'),

    scheduledAt: timestamp('scheduled_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_notif_deliv_notification').on(table.notificationId),
    index('idx_notif_deliv_business').on(table.businessId),
    index('idx_notif_deliv_status_schedule').on(table.status, table.scheduledAt),
    index('idx_notif_deliv_provider_msg').on(table.providerMessageId),

    // Prevent duplicate retry attempts for the same channel
    uniqueIndex('uq_notif_attempt').on(table.notificationId, table.channel, table.attemptNumber),

    check('chk_notif_deliv_attempt', sql`${table.attemptNumber} > 0`),
  ],
);
