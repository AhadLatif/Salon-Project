import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { businesses } from './businesses.js';

export const businessSettings = pgTable('business_settings', {
  id: uuid('id').primaryKey(),
  // .unique() enforces the strict 1-to-1 relationship. A business can only have ONE settings row.
  businessId: uuid('business_id')
    .notNull()
    .unique()
    .references(() => businesses.id, { onDelete: 'cascade' }),

  // IETF BCP 47 language tag (e.g., 'en-US', 'ur-PK')
  language: text('language').notNull().default('en-US'),

  // Text blocks for marketplace display
  cancellationPolicy: text('cancellation_policy'),
  depositPolicy: text('deposit_policy'),

  // JSONB is perfect here because tax configurations can vary wildly by country
  // (e.g., flat rate, compound, tax-inclusive vs exclusive)
  taxSettings: jsonb('tax_settings').default({}),

  // A helpful boolean flag to quickly check if a deposit is required before booking
  requireDeposit: boolean('require_deposit').notNull().default(false),

  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
