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
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { businessMembers } from '../RBAC/business_members.js';
import { generateId, helperTimeStamp } from '../shared/index.js';
import { paymentTransactions } from './payment_transactions.js';

export const refundStatusEnum = pgEnum('refund_status', ['pending', 'completed', 'failed']);

export const refunds = pgTable(
  'refunds',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    // Added Tenant Boundary
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),

    paymentTransactionId: uuid('payment_transaction_id').notNull(),

    status: refundStatusEnum('status').notNull().default('pending'),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    reason: text('reason'),

    // Who authorized the refund locally?
    processedBy: uuid('processed_by'),

    gatewayRefundId: text('gateway_refund_id'),
    gatewayReference: text('gateway_reference'),

    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' }),
    failureReason: text('failure_reason'),
    metadata: jsonb('metadata'),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_refunds_business').on(table.businessId),
    index('idx_refunds_transaction').on(table.paymentTransactionId),
    index('idx_refunds_status').on(table.status),

    foreignKey({
      name: 'fk_refund_payment_tenant',
      columns: [table.businessId, table.paymentTransactionId],
      foreignColumns: [paymentTransactions.businessId, paymentTransactions.id],
    }).onDelete('restrict'),

    foreignKey({
      name: 'fk_refund_processed_by_tenant',
      columns: [table.businessId, table.processedBy],
      foreignColumns: [businessMembers.businessId, businessMembers.id],
    }).onDelete('restrict'),

    // Idempotency for webhooks
    uniqueIndex('uq_refunds_gateway')
      .on(table.gatewayRefundId)
      .where(sql`${table.gatewayRefundId} IS NOT NULL`),

    check('chk_refunds_amount', sql`${table.amount} > 0`),
  ],
);
