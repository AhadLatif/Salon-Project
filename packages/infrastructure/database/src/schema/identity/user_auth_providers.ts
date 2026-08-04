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
  varchar,
} from 'drizzle-orm/pg-core';
import { generateId, helperTimeStamp } from '../shared/index.js';
import { users } from './users.js';

export const authProviderEnum = pgEnum('auth_provider', ['email', 'google', 'apple', 'microsoft']);

export const userAuthProviders = pgTable(
  'user_auth_providers',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),

    provider: authProviderEnum('provider').notNull(),

    providerUserId: varchar('provider_user_id', {
      length: 255,
    }).notNull(),

    providerEmail: varchar('provider_email', {
      length: 320,
    }),

    providerEmailVerifiedAt: timestamp('provider_email_verified_at', {
      withTimezone: true,
      mode: 'date',
    }),

    passwordHash: text('password_hash'),

    providerProfile: jsonb('provider_profile'),

    linkedAt: timestamp('linked_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),

    lastUsedAt: timestamp('last_used_at', {
      withTimezone: true,
      mode: 'date',
    }),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_user_auth_providers_user').on(table.userId),

    index('idx_user_auth_providers_last_used').on(table.lastUsedAt),

    uniqueIndex('uq_user_auth_provider').on(table.provider, table.providerUserId),

    uniqueIndex('uq_user_email_provider')
      .on(sql`lower(${table.providerEmail})`)
      .where(sql`${table.provider} = 'email'`),

    check('chk_provider_user_id', sql`length(trim(${table.providerUserId})) > 0`),

    check(
      'chk_email_provider_password',
      sql`
      (
        ${table.provider} = 'email'
        AND ${table.passwordHash} IS NOT NULL
      )
      OR
      (
        ${table.provider} <> 'email'
        AND ${table.passwordHash} IS NULL
      )
    `,
    ),
  ],
);
