import { foreignKey, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
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

    businessCustomerId: uuid('business_customer_id').notNull(),

    authorId: uuid('author_id'),

    note: text('note').notNull(),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_customer_notes_business').on(table.businessId),
    index('idx_customer_notes_customer').on(table.businessCustomerId),
    index('idx_customer_notes_author').on(table.authorId),

    // Composite FK: a note's customer must belong to the SAME business as the
    // note itself. Prevents cross-tenant references (IDOR via customer_id).
    foreignKey({
      name: 'customer_notes_business_customer_id_business_customers_id_fk',
      columns: [table.businessId, table.businessCustomerId],
      foreignColumns: [businessCustomers.businessId, businessCustomers.id],
    }).onDelete('cascade'),

    // Composite FK: a note's author (business member) must belong to the SAME
    // business as the note itself. authorId stays nullable (system/API notes).
    foreignKey({
      name: 'customer_notes_author_id_business_members_id_fk',
      columns: [table.businessId, table.authorId],
      foreignColumns: [businessMembers.businessId, businessMembers.id],
    }).onDelete('set null'),
  ],
);
