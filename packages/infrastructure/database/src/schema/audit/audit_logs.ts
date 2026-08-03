import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { users } from '../identity/users.js';
import { generateId } from '../shared/index.js';

export const auditActorTypeEnum = pgEnum('audit_actor_type', ['USER', 'SYSTEM']);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    // Nullable for platform-wide events (e.g. a background cron job running)
    businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'set null' }),

    actorType: auditActorTypeEnum('actor_type').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorUserName: varchar('actor_user_name', { length: 255 }),
    actorUserEmail: varchar('actor_user_email', { length: 320 }),

    action: varchar('action', { length: 100 }).notNull(), // e.g., 'appointment.cancelled'
    resourceType: varchar('resource_type', { length: 100 }).notNull(), // e.g., 'appointment'
    resourceId: uuid('resource_id').notNull(),

    changes: jsonb('changes'), // Structured { before: {}, after: {} }
    metadata: jsonb('metadata'), // Contextual data

    ipAddress: varchar('ip_address', { length: 45 }), // Supports IPv6
    userAgent: text('user_agent'),

    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_audit_logs_business').on(table.businessId),
    index('idx_audit_logs_actor').on(table.actorUserId),
    index('idx_audit_logs_resource').on(table.resourceType, table.resourceId),
    index('idx_audit_logs_action').on(table.action),
    index('idx_audit_logs_occurred_at').on(table.occurredAt),

    // Enforce Actor Consistency
    check(
      'chk_audit_actor_consistency',
      sql`
        (${table.actorType} = 'SYSTEM' AND ${table.actorUserId} IS NULL)
        OR
        (
          ${table.actorType} = 'USER' AND (
            ${table.actorUserId} IS NOT NULL
            OR ${table.actorUserName} IS NOT NULL
            OR ${table.actorUserEmail} IS NOT NULL
          )
        )
      `,
    ),
  ],
);
