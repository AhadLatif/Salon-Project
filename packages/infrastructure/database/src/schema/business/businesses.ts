import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const businessStatusEnum = pgEnum('business_status', [
  'pending',
  'active',
  'suspended',
  'archived',
]);

export const businesses = pgTable(
  'businesses',
  {
    id: uuid('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    email: text('email').notNull(),
    phoneNumber: text('phone_number').notNull(),
    status: businessStatusEnum('status').notNull().default('pending'),
    socialLinks: jsonb('social_links'),
    verifiedAt: timestamp('verified_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('idx_businesses_status').on(table.status)],
);
