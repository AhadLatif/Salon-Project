// Payment tables were defined but never exported from this barrel, so nothing
// reached the root schema root/index.ts (schema/index.ts exports './payment/index.js').
// Exporting here exposes payments, payment_transactions, refunds + relations to
// @salon/database consumers. This is the single reason the payment module's data
// model was invisible to Drizzle — fixed here rather than in the module.
export * from './payment_transactions.js';
export * from './payments.js';
export * from './refunds.js';
export * from './relations.js';
