import { boolean, foreignKey, index, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { branches } from '../business/branches.js';
import { businesses } from '../business/businesses.js';
import { generateId, helperTimeStamp } from '../shared/index.js';
import { services } from './services.js';

export const branchServices = pgTable(
  'branch_services',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    // The Tenant Boundary
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),

    serviceId: uuid('service_id').notNull(),

    branchId: uuid('branch_id').notNull(),

    isBookable: boolean('is_bookable').notNull().default(true),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_branch_services_branch').on(table.branchId),
    index('idx_branch_services_service').on(table.serviceId),

    foreignKey({
      name: 'fk_branch_services_service_tenant',
      columns: [table.businessId, table.serviceId],
      foreignColumns: [services.businessId, services.id],
    }).onDelete('restrict'),

    foreignKey({
      name: 'fk_branch_services_branch_tenant',
      columns: [table.businessId, table.branchId],
      foreignColumns: [branches.businessId, branches.id],
    }).onDelete('restrict'),

    // A service is only configured once per branch
    uniqueIndex('uq_branch_services_branch_service').on(table.branchId, table.serviceId),
  ],
);
