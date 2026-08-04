import { sql } from 'drizzle-orm';
import {
  char,
  check,
  foreignKey,
  index,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { appointments } from '../appointment/appointments.js';
import { businesses } from '../business/businesses.js';
import { generateId, helperTimeStamp } from '../shared/index.js';

export const paymentStatusEnum = pgEnum('payment_status', [
  'unpaid',
  'partially_paid',
  'paid',
  'partially_refunded',
  'refunded',
]);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    //  Tenant Boundary
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),

    appointmentId: uuid('appointment_id').notNull(),

    status: paymentStatusEnum('status').notNull().default('unpaid'),
    currency: char('currency', { length: 3 }).notNull().default('PKR'),

    // Financial Snapshots
    subtotalAmount: numeric('subtotal_amount', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    discountAmount: numeric('discount_amount', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    taxAmount: numeric('tax_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
    tipAmount: numeric('tip_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
    totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),

    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_payments_business').on(table.businessId),
    index('idx_payments_status').on(table.status),
    index('idx_payments_paid_at').on(table.paidAt),

    foreignKey({
      name: 'fk_payments_appointment_tenant',
      columns: [table.businessId, table.appointmentId],
      foreignColumns: [appointments.businessId, appointments.id],
    }).onDelete('restrict'),

    // Exactly one payment per appointment
    uniqueIndex('uq_payments_appointment').on(table.appointmentId),

    // Tenant-scoped identity for composite foreign keys
    unique('uq_payments_business_id').on(table.businessId, table.id),

    // Integrity Checks
    check('chk_payments_subtotal', sql`${table.subtotalAmount} >= 0`),
    check('chk_payments_discount', sql`${table.discountAmount} >= 0`),
    check('chk_payments_tax', sql`${table.taxAmount} >= 0`),
    check('chk_payments_tip', sql`${table.tipAmount} >= 0`),
    check('chk_payments_total', sql`${table.totalAmount} >= 0`),
  ],
);
