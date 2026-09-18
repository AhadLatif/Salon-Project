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

    // Which payment provider issued this refund.
    //
    // Denormalized (deliberately duplicated) from `payment_transactions.gateway` because it is
    // part of THIS row's natural key — see `uq_refunds_gateway` below. An external id is only
    // meaningful together with the provider that minted it, so the provider has to be stored
    // here rather than joined for.
    gateway: text('gateway'),

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

    // Idempotency for webhooks.
    //
    // The external refund id is minted by the PAYMENT PROVIDER, so it is only unique WITHIN
    // that provider — two gateways may each legitimately have a refund "1000". Scoping the key
    // to (gateway, gateway_refund_id) is what stops one provider's numbering from rejecting a
    // perfectly valid refund issued by another. This mirrors payment_transactions'
    // `uq_pay_tx_gateway`; keeping the two siblings identical is the point.
    //
    // COALESCE(gateway, ...) is load-bearing, not decoration: in SQL a NULL is never equal to
    // another NULL, so a plain (gateway, gateway_refund_id) index would still allow unlimited
    // duplicate rows whenever `gateway` is unset. Substituting a sentinel makes those rows
    // collide like any other value.
    uniqueIndex('uq_refunds_gateway')
      .on(sql`COALESCE(${table.gateway}, '__drizzle_null__')`, table.gatewayRefundId)
      .where(sql`${table.gatewayRefundId} IS NOT NULL`),

    check('chk_refunds_amount', sql`${table.amount} > 0`),
  ],
);
