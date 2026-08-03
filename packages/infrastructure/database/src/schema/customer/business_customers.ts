import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { users } from '../identity/users.js';
import { generateId, helperTimeStamp } from '../shared/index.js';

export const customerStatusEnum = pgEnum('customer_status', ['active', 'blocked', 'archived']);
export const customerGenderEnum = pgEnum('customer_gender', [
  'male',
  'female',
  'other',
  'prefer_not_to_say',
]);

export const businessCustomers = pgTable(
  'business_customers',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),

    // Nullable for Walk-ins/Guests
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

    firstName: text('first_name').notNull(),
    lastName: text('last_name'),
    phoneNumber: text('phone_number'),
    email: text('email'),

    gender: customerGenderEnum('gender').default('prefer_not_to_say'),
    dateOfBirth: date('date_of_birth'),

    status: customerStatusEnum('status').notNull().default('active'),
    marketingOptIn: boolean('marketing_opt_in').notNull().default(false),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_bus_customers_business').on(table.businessId),
    index('idx_bus_customers_user').on(table.userId),
    index('idx_bus_customers_phone').on(table.phoneNumber),
    index('idx_bus_customers_status').on(table.status),

    // At least one contact method must exist
    check(
      'chk_bus_customers_contact',
      sql`${table.email} IS NOT NULL OR ${table.phoneNumber} IS NOT NULL`,
    ),

    unique('uq_bus_customers_tenant_id').on(table.businessId, table.id),

    // PREVENT CLONES: A business cannot have duplicate emails in its CRM
    uniqueIndex('uq_bus_customers_email')
      .on(table.businessId, sql`lower(${table.email})`)
      .where(sql`${table.email} IS NOT NULL`),
  ],
);
