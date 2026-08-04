import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { generateId, helperTimeStamp } from '../shared/index.js';
import { users } from './users.js';

export const userTokenTypeEnum = pgEnum('user_token_type', [
  'email_verification',
  'password_reset',
  'email_change',
  'magic_link',
  'invitation',
]);

export const userTokens = pgTable(
  'user_tokens',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),

    tokenType: userTokenTypeEnum('token_type').notNull(),

    tokenHash: text('token_hash').notNull(),

    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),

    consumedAt: timestamp('consumed_at', {
      withTimezone: true,
      mode: 'date',
    }),

    context: jsonb('context'),
    /**
     * Tokens are generally "insert-only" records (where successful usage is tracked by the explicit consumedAt column),
     * updatedAt is technically dead weight here
     */
    createdAt: helperTimeStamp.createdAt,
  },
  (table) => [
    index('idx_user_tokens_user').on(table.userId),

    index('idx_user_tokens_type').on(table.tokenType),

    index('idx_user_tokens_expires').on(table.expiresAt),

    index('idx_user_tokens_consumed').on(table.consumedAt),

    uniqueIndex('uq_user_tokens_hash').on(table.tokenHash),

    check('chk_user_tokens_expiry', sql`${table.expiresAt} > ${table.createdAt}`),

    check(
      'chk_user_tokens_consumed',
      sql`
        ${table.consumedAt} IS NULL
        OR
        ${table.consumedAt} <= ${table.expiresAt}
      `,
    ),
  ],
);
