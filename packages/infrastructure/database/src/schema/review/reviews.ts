import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { appointments } from '../appointment/appointments.js';
import { businesses } from '../business/businesses.js';
import { businessCustomers } from '../customer/business_customers.js';
import { generateId, helperTimeStamp } from '../shared/index.js';

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    // Tenant Boundary
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),

    appointmentId: uuid('appointment_id').notNull(),
    businessCustomerId: uuid('business_customer_id').notNull(),

    rating: smallint('rating').notNull(),
    title: text('title'),
    comment: text('comment'),

    isAnonymous: boolean('is_anonymous').notNull().default(false),
    isHidden: boolean('is_hidden').notNull().default(false), // Moderation flag

    moderatedAt: timestamp('moderated_at', { withTimezone: true, mode: 'date' }),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_reviews_business').on(table.businessId),
    index('idx_reviews_rating').on(table.rating),
    index('idx_reviews_created_at').on(table.createdAt),

    foreignKey({
      name: 'fk_review_appointment_tenant',
      columns: [table.businessId, table.appointmentId],
      foreignColumns: [appointments.businessId, appointments.id],
    }).onDelete('restrict'),

    foreignKey({
      name: 'fk_review_customer_tenant',
      columns: [table.businessId, table.businessCustomerId],
      foreignColumns: [businessCustomers.businessId, businessCustomers.id],
    }).onDelete('restrict'),

    unique('uq_reviews_tenant_id').on(table.businessId, table.id),

    // An appointment can only receive ONE review
    uniqueIndex('uq_reviews_appointment').on(table.appointmentId),

    // Rating must be between 1 and 5 stars
    check('chk_reviews_rating', sql`${table.rating} BETWEEN 1 AND 5`),
  ],
);
