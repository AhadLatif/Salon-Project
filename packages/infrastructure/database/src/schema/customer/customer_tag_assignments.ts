import { foreignKey, index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { businessMembers } from '../RBAC/business_members.js';
import { businessCustomers } from './business_customers.js';
import { customerTags } from './customer_tags.js';

export const customerTagAssignments = pgTable(
  'customer_tag_assignments',
  {
    // Tenant Boundary
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),

    businessCustomerId: uuid('business_customer_id').notNull(),

    customerTagId: uuid('customer_tag_id').notNull(),

    assignedBy: uuid('assigned_by').references(() => businessMembers.id, { onDelete: 'set null' }),

    assignedAt: timestamp('assigned_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Composite PK ensures a tag is only assigned once per customer
    primaryKey({ columns: [table.businessCustomerId, table.customerTagId] }),

    foreignKey({
      name: 'fk_customer_tag_assign_customer_tenant',
      columns: [table.businessId, table.businessCustomerId],
      foreignColumns: [businessCustomers.businessId, businessCustomers.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'fk_customer_tag_assign_tag_tenant',
      columns: [table.businessId, table.customerTagId],
      foreignColumns: [customerTags.businessId, customerTags.id],
    }).onDelete('cascade'),

    index('idx_customer_tag_assign_tag').on(table.customerTagId),
    index('idx_customer_tag_assign_biz').on(table.businessId),
  ],
);
