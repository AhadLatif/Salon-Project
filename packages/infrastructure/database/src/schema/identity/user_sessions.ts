import { sql } from 'drizzle-orm';
import {
  check,
  index,
  inet,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { generateId, helperTimeStamp } from '../shared/index.js';
import { userAuthProviders } from './user_auth_providers.js';
import { users } from './users.js';

export const deviceTypeEnum = pgEnum('device_type', ['desktop', 'mobile', 'tablet', 'unknown']);

export const sessionRevokeReasonEnum = pgEnum('session_revoke_reason', [
  'logout',
  'logout_all',
  'compromised',
  'expired',
  'admin',
]);

export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),

    authProviderId: uuid('auth_provider_id')
      .notNull()
      .references(() => userAuthProviders.id, {
        onDelete: 'cascade',
      }),

    refreshTokenHash: text('refresh_token_hash').notNull(),

    deviceName: varchar('device_name', {
      length: 255,
    }),

    deviceType: deviceTypeEnum('device_type').default('unknown').notNull(),

    userAgent: text('user_agent'),

    createdIp: inet('created_ip'),

    lastIp: inet('last_ip'),

    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),

    lastUsedAt: timestamp('last_used_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),

    revokedAt: timestamp('revoked_at', {
      withTimezone: true,
      mode: 'date',
    }),

    revokeReason: sessionRevokeReasonEnum('revoke_reason'),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_user_sessions_user').on(table.userId),

    index('idx_user_sessions_provider').on(table.authProviderId),

    index('idx_user_sessions_expires').on(table.expiresAt),

    index('idx_user_sessions_last_used').on(table.lastUsedAt),

    uniqueIndex('uq_user_sessions_refresh_token_hash').on(table.refreshTokenHash),

    check('chk_user_sessions_expiry', sql`${table.expiresAt} > ${table.createdAt}`),

    check(
      'chk_user_sessions_revocation',
      sql`
        (
          ${table.revokedAt} IS NULL
          AND ${table.revokeReason} IS NULL
        )
        OR
        (
          ${table.revokedAt} IS NOT NULL
          AND ${table.revokeReason} IS NOT NULL
        )
      `,
    ),
  ],
);
