import { index, pgTable, text, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { generateId, helperTimeStamp } from '../shared/index.js';

export const customerTags = pgTable(
  'customer_tags',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    color: text('color'), // hex code
    description: text('description'),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_customer_tags_business').on(table.businessId),

    unique('uq_customer_tags_tenant').on(table.businessId, table.id),

    // Tag names must be unique within a business
    uniqueIndex('uq_customer_tags_business_name').on(table.businessId, table.name),
  ],
);
