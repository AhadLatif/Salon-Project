import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { generateId, helperTimeStamp } from '../shared/index.js';

export const serviceCategories = pgTable(
  'service_categories',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    description: text('description'),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_service_categories_business').on(table.businessId),
    index('idx_service_categories_order').on(table.displayOrder),
    index('idx_service_categories_active').on(table.isActive),

    // Category names must be unique within a single business
    uniqueIndex('uq_service_categories_business_name').on(table.businessId, table.name),
    unique('uq_service_categories_tenant').on(table.businessId, table.id),
  ],
);
