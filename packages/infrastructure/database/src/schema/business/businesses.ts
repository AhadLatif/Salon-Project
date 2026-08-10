import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { generateId, helperTimeStamp } from '../shared/index.js';

export const businessStatusEnum = pgEnum('business_status', [
  'pending',
  'active',
  'suspended',
  'archived',
]);

export const businesses = pgTable(
  'businesses',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    email: text('email').notNull(),
    phoneNumber: text('phone_number').notNull(),
    status: businessStatusEnum('status').notNull().default('pending'),
    socialLinks: jsonb('social_links'),
    verifiedAt: timestamp('verified_at', { withTimezone: true, mode: 'date' }),
    ...helperTimeStamp,
  },
  (table) => [
    index('idx_businesses_status').on(table.status),
    check('chk_businesses_slug', sql`${table.slug} ~ '^[a-z0-9-]+$'`),
    check('chk_businesses_name', sql`length(trim(${table.name})) > 0`),
    check('chk_businesses_phone_e164', sql`${table.phoneNumber} ~ '^\\+[1-9][0-9]{1,14}$'`),
  ],
);
