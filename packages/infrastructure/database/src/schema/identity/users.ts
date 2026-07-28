import { generateId } from '../shared/index.js';
import { helperTimeStamp } from '../shared/index.js';

import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  uuid,
  varchar,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';




export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'deleted']);

export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()), // id is being generated at application level

    firstName: varchar('first_name', { length: 100 }).notNull(),

    lastName: varchar('last_name', { length: 100 }).notNull(),

    primaryEmail: varchar('primary_email', { length: 320 }).notNull(),

    primaryPhone: varchar('primary_phone', { length: 20 }),

    avatarUrl: text('avatar_url'),

    status: userStatusEnum('status').default('active').notNull(),

    //this `timstamp` is not shared helper this is library function
    emailVerifiedAt: timestamp('email_verified_at', {
      withTimezone: true,
      mode: 'date',
    }),

    phoneVerifiedAt: timestamp('phone_verified_at', {
      withTimezone: true,
      mode: 'date',
    }),
    ...helperTimeStamp, // this `timestamps` is a custom shared helper not a library function
  },
  (table) => [
    index('idx_users_status').on(table.status),

    uniqueIndex('uq_users_primary_email').on(sql`lower(${table.primaryEmail})`),

    check('chk_users_first_name', sql`length(trim(${table.firstName})) > 0`),

    check('chk_users_last_name', sql`length(trim(${table.lastName})) > 0`),

    // check phone number to match the E.164 format
    // This forces your API to clean the input _before_ it hits the database.
    check(
      'chk_users_primary_phone_e164',
      sql`${table.primaryPhone} IS NULL
          OR ${table.primaryPhone} ~ '^\\+[1-9][0-9]{1,14}$'`,
    ),
  ],
);
