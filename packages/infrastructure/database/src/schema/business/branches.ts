import { sql } from 'drizzle-orm';
import {
  char,
  check,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { generateId, helperTimeStamp } from '../shared/index.js';
import { businesses } from './businesses.js'; // Adjust path as needed

export const branchStatusEnum = pgEnum('branch_status', ['active', 'inactive', 'archived']);

export const branches = pgTable(
  'branches',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    phoneNumber: text('phone_number'),
    email: text('email'),
    timezone: text('timezone').notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    addressLine1: text('address_line_1').notNull(),
    addressLine2: text('address_line_2'),
    city: text('city').notNull(),
    state: text('state'),
    postalCode: text('postal_code'),
    countryCode: char('country_code', { length: 2 }).notNull(),
    latitude: numeric('latitude', { precision: 9, scale: 6 }),
    longitude: numeric('longitude', { precision: 9, scale: 6 }),
    status: branchStatusEnum('status').notNull().default('active'),
    ...helperTimeStamp,
  },
  (table) => [
    index('idx_branches_business').on(table.businessId),
    index('idx_branches_status').on(table.status),
    index('idx_branches_city').on(table.city),
    unique('uq_branches_tenant').on(table.businessId, table.id),
    check('chk_branches_name', sql`length(trim(${table.name})) > 0`),
  ],
);
