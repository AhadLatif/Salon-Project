import { relations } from 'drizzle-orm';
import { appointments } from '../appointment/appointments.js';
import { businesses } from '../business/businesses.js';
import { businessMembers } from '../RBAC/business_members.js';
import { paymentTransactions } from './payment_transactions.js';
import { payments } from './payments.js';
import { refunds } from './refunds.js';

// --- Payments (The Aggregate) ---
export const paymentsRelations = relations(payments, ({ one, many }) => ({
  business: one(businesses, {
    fields: [payments.businessId],
    references: [businesses.id],
  }),
  appointment: one(appointments, {
    fields: [payments.appointmentId],
    references: [appointments.id],
  }),
  transactions: many(paymentTransactions),
}));

// --- Payment Transactions (The Money Movement) ---
export const paymentTransactionsRelations = relations(paymentTransactions, ({ one, many }) => ({
  business: one(businesses, {
    fields: [paymentTransactions.businessId],
    references: [businesses.id],
  }),
  payment: one(payments, {
    fields: [paymentTransactions.paymentId],
    references: [payments.id],
  }),
  refunds: many(refunds),
}));

// --- Refunds ---
export const refundsRelations = relations(refunds, ({ one }) => ({
  business: one(businesses, {
    fields: [refunds.businessId],
    references: [businesses.id],
  }),
  transaction: one(paymentTransactions, {
    fields: [refunds.paymentTransactionId],
    references: [paymentTransactions.id],
  }),
  processedBy: one(businessMembers, {
    fields: [refunds.processedBy],
    references: [businessMembers.id],
  }),
}));
