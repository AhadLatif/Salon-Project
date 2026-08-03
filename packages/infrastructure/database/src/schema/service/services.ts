import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  numeric,
  pgTable,
  smallint,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { generateId, helperTimeStamp } from '../shared/index.js';
import { serviceCategories } from './service_categories.js';

export const services = pgTable(
  'services',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),

    categoryId: uuid('category_id').notNull(),

    name: text('name').notNull(),
    description: text('description'),

    // Fallback/Default values
    defaultPrice: numeric('default_price', { precision: 10, scale: 2 }).notNull(),
    defaultDurationMinutes: smallint('default_duration_minutes').notNull(),
    bufferBeforeMinutes: smallint('buffer_before_minutes').notNull().default(0),
    bufferAfterMinutes: smallint('buffer_after_minutes').notNull().default(0),

    color: text('color'), // e.g., '#FF5733' for calendar UI

    isBookable: boolean('is_bookable').notNull().default(true),
    isActive: boolean('is_active').notNull().default(true),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_services_business').on(table.businessId),
    index('idx_services_category').on(table.categoryId),
    index('idx_services_bookable').on(table.isBookable),
    index('idx_services_active').on(table.isActive),

    foreignKey({
      name: 'fk_services_category_tenant',
      columns: [table.businessId, table.categoryId],
      foreignColumns: [serviceCategories.businessId, serviceCategories.id],
    }).onDelete('restrict'),

    uniqueIndex('uq_services_business_name').on(table.businessId, table.name),
    unique('uq_services_tenant_id').on(table.businessId, table.id),

    // Data Integrity Checks
    check('chk_services_default_price', sql`${table.defaultPrice} >= 0`),
    check('chk_services_duration', sql`${table.defaultDurationMinutes} > 0`),
    check('chk_services_buffer_before', sql`${table.bufferBeforeMinutes} >= 0`),
    check('chk_services_buffer_after', sql`${table.bufferAfterMinutes} >= 0`),
  ],
);
