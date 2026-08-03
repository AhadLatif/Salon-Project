import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { businessMembers } from '../RBAC/business_members.js';
import { generateId, helperTimeStamp } from '../shared/index.js';
import { businessCustomers } from './business_customers.js';

export const customerNotes = pgTable(
  'customer_notes',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    //  Tenant Boundary
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),

    businessCustomerId: uuid('business_customer_id')
      .notNull()
      .references(() => businessCustomers.id, { onDelete: 'cascade' }),

    authorId: uuid('author_id').references(() => businessMembers.id, { onDelete: 'set null' }),

    note: text('note').notNull(),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_customer_notes_business').on(table.businessId),
    index('idx_customer_notes_customer').on(table.businessCustomerId),
    index('idx_customer_notes_author').on(table.authorId),
  ],
);
