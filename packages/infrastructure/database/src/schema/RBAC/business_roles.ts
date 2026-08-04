import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { businesses } from '../business/businesses.js';
export const businessRoles = pgTable(
  'business_roles',
  {
    id: uuid('id').primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    // True for default roles like 'Owner' or 'Staff' seeded at business creation
    isSystem: boolean('is_system').notNull().default(false),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('idx_business_roles_business').on(table.businessId),
    index('idx_business_roles_order').on(table.displayOrder),
    // A business cannot have two roles with the exact same name (e.g., two "Manager" roles)
    unique('uq_business_roles_name').on(table.businessId, table.name),
  ],
);
