import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { generateId, helperTimeStamp } from '../shared/index.js';

export const businessRoles = pgTable(
  'business_roles',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    // True for default roles like 'Owner' or 'Staff' seeded at business creation
    isSystem: boolean('is_system').notNull().default(false),
    displayOrder: integer('display_order').notNull().default(0),
    ...helperTimeStamp,
  },
  (table) => [
    index('idx_business_roles_business').on(table.businessId),
    index('idx_business_roles_order').on(table.displayOrder),
    // A business cannot have two roles with the exact same name (e.g., two "Manager" roles)
    unique('uq_business_roles_name').on(table.businessId, table.name),
    unique('uq_bus_roles_tenant_id').on(table.businessId, table.id),
    check('chk_business_roles_name', sql`length(trim(${table.name})) > 0`),
  ],
);
