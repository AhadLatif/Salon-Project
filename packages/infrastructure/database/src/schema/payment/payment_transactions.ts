import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { appointments } from '../appointment/appointments.js';
import { businesses } from '../business/businesses.js';
import { businessCustomers } from '../customer/business_customers.js';
import { generateId, helperTimeStamp } from '../shared/index.js';
import { payments } from './payments.js';

export const paymentMethodEnum = pgEnum('payment_method', [
  'cash',
  'card',
  'online',
  'bank_transfer',
  'gift_card',
]);

export const transactionStatusEnum = pgEnum('transaction_status', [
  'pending',
  'authorized',
  'captured',
  'failed',
  'cancelled',
]);

export const paymentTransactions = pgTable(
  'payment_transactions',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    //  Added Tenant Boundary
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),

    appointmentId: uuid('appointment_id').notNull(),
    businessCustomerId: uuid('business_customer_id').notNull(),
    paymentId: uuid('payment_id').notNull(),

    method: paymentMethodEnum('method').notNull(),
    status: transactionStatusEnum('status').notNull().default('pending'),

    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),

    gateway: text('gateway'), // e.g., 'stripe', 'fresha_pay'
    gatewayTransactionId: text('gateway_transaction_id'),
    gatewayReference: text('gateway_reference'),

    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' }),
    failureReason: text('failure_reason'),
    metadata: jsonb('metadata'), // Perfect for Stripe webhook payloads

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_pay_tx_business').on(table.businessId),
    index('idx_pay_tx_payment').on(table.paymentId),
    index('idx_pay_tx_status').on(table.status),
    index('idx_pay_tx_method').on(table.method),
    index('idx_pay_tx_processed_at').on(table.processedAt),

    foreignKey({
      name: 'fk_payment_appointment_tenant',
      columns: [table.businessId, table.appointmentId],
      foreignColumns: [appointments.businessId, appointments.id],
    }).onDelete('restrict'),

    foreignKey({
      name: 'fk_payment_customer_tenant',
      columns: [table.businessId, table.businessCustomerId],
      foreignColumns: [businessCustomers.businessId, businessCustomers.id],
    }).onDelete('restrict'),

    foreignKey({
      name: 'fk_payment_payment_tenant',
      columns: [table.businessId, table.paymentId],
      foreignColumns: [payments.businessId, payments.id],
    }).onDelete('restrict'),

    unique('uq_pay_tx_tenant_id').on(table.businessId, table.id),

    // Idempotency: Prevent duplicate webhooks for the same external transaction
    uniqueIndex('uq_pay_tx_gateway')
      .on(sql`COALESCE(${table.gateway}, '__drizzle_null__')`, table.gatewayTransactionId)
      .where(sql`${table.gatewayTransactionId} IS NOT NULL`),

    check('chk_pay_tx_amount', sql`${table.amount} > 0`),
  ],
);
