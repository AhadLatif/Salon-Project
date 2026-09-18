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

    /**
     * Hash of the refresh token we rotated away on the last successful refresh.
     *
     * The live token hash lives in `refresh_token_hash`. When we rotate, we MOVE the old hash
     * here (rather than discarding it) so that a future request presenting the already-exchanged
     * token is recognisable — not just "an unknown string". That single column is what lets us
     * distinguish "bad credentials" from "thin thief replaying a stolen token" and escalate
     * accordingly (revoke every session).
     *
     * Nullable because a freshly created session has rotated away nothing yet, and never will
     * if the session does not survive its first refresh.
     */
    previousRefreshTokenHash: text('previous_refresh_token_hash'),

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

    /**
     * Backs `SessionRepository.findByTokenHash`, which looks a session up by EITHER hash
     * (`refresh_token_hash` OR `previous_refresh_token_hash`).
     *
     * Why it is needed at all: PostgreSQL can only use index shortcuts for an `OR` when EVERY
     * branch of the condition has one. With this column unindexed the planner falls back to
     * reading the whole table, and this runs on the hottest path in the auth system — every
     * token refresh and every logout.
     *
     * Why PARTIAL: the column is NULL for every session that has never refreshed, which is most
     * rows. Excluding NULLs keeps the index small. It stays usable for the lookup because a
     * search is only ever performed with a real hash, never NULL.
     *
     * Why UNIQUE: refresh tokens are 256-bit random values handed to exactly one session, so a
     * duplicate cannot occur; declaring it unique turns that assumption into a guarantee. It
     * also removes an ambiguity in the lookup, which takes the first matching row.
     */
    uniqueIndex('uq_user_sessions_previous_refresh_token_hash')
      .on(table.previousRefreshTokenHash)
      .where(sql`${table.previousRefreshTokenHash} IS NOT NULL`),

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
