/**
 * Payment module domain entities.
 *
 * Schema source-of-truth: packages/infrastructure/database/src/schema/payment/
 * (payments, payment_transactions, refunds).
 *
 * Money fields are strings (numeric(10,2) returned as text). All arithmetic goes
 * through the pure money util so float rounding never enters the accounting.
 */

export type PaymentStatus =
  | 'unpaid'
  | 'partially_paid'
  | 'paid'
  | 'partially_refunded'
  | 'refunded';

export type PaymentMethod = 'cash' | 'card' | 'online' | 'bank_transfer' | 'gift_card';

export type TransactionStatus = 'pending' | 'authorized' | 'captured' | 'failed' | 'cancelled';

export type RefundStatus = 'pending' | 'completed' | 'failed';

export interface PaymentTransactionEntity {
  id: string;
  businessId: string;
  appointmentId: string;
  businessCustomerId: string;
  paymentId: string;
  method: PaymentMethod;
  status: TransactionStatus;
  amount: string;
  gateway: string | null;
  gatewayTransactionId: string | null;
  gatewayReference: string | null;
  processedAt: Date | null;
  failureReason: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefundEntity {
  id: string;
  businessId: string;
  paymentTransactionId: string;
  status: RefundStatus;
  amount: string;
  reason: string | null;
  processedBy: string | null;
  gatewayRefundId: string | null;
  gatewayReference: string | null;
  processedAt: Date | null;
  failureReason: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}

/** One payment aggregate per appointment (DB enforces via unique appointment_id). */
export interface PaymentEntity {
  id: string;
  businessId: string;
  appointmentId: string;
  status: PaymentStatus;
  currency: string;
  subtotalAmount: string;
  discountAmount: string;
  taxAmount: string;
  tipAmount: string;
  totalAmount: string;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  transactions: PaymentTransactionEntity[];
  refunds: RefundEntity[];
}

/** Lightweight listing shape (avoids loading every transaction/refund row). */
export interface PaymentSummaryEntity {
  id: string;
  appointmentId: string;
  status: PaymentStatus;
  currency: string;
  totalAmount: string;
  subtotalAmount: string;
  paidAt: Date | null;
  createdAt: Date;
  capturedAmount: string;
  refundedAmount: string;
}
