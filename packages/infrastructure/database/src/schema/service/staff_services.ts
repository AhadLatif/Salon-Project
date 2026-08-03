import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  numeric,
  pgTable,
  smallint,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { generateId, helperTimeStamp } from '../shared/index.js';
import { staffMembers } from '../staff/staff_members.js';
import { services } from './services.js';

export const staffServices = pgTable(
  'staff_services',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    // The Tenant Boundary
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),

    serviceId: uuid('service_id').notNull(),

    staffMemberId: uuid('staff_member_id').notNull(),

    // NULL means inherit from services table
    overridePrice: numeric('override_price', { precision: 10, scale: 2 }),
    overrideDurationMinutes: smallint('override_duration_minutes'),

    isBookable: boolean('is_bookable').notNull().default(true),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_staff_services_staff').on(table.staffMemberId),
    index('idx_staff_services_service').on(table.serviceId),

    foreignKey({
      name: 'fk_staff_services_staff_tenant',
      columns: [table.businessId, table.staffMemberId],
      foreignColumns: [staffMembers.businessId, staffMembers.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'fk_staff_services_service_tenant',
      columns: [table.businessId, table.serviceId],
      foreignColumns: [services.businessId, services.id],
    }).onDelete('cascade'),

    // A staff member can only have ONE configuration per service
    uniqueIndex('uq_staff_services_staff_service').on(table.staffMemberId, table.serviceId),

    check(
      'chk_staff_services_override_price',
      sql`${table.overridePrice} IS NULL OR ${table.overridePrice} >= 0`,
    ),
    check(
      'chk_staff_services_override_duration',
      sql`${table.overrideDurationMinutes} IS NULL OR ${table.overrideDurationMinutes} > 0`,
    ),
  ],
);
