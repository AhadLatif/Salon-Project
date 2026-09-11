import type { PaymentEntity, PaymentSummaryEntity } from '../../domain/entities/payment.entity.js';

/** Cash capture inputs. Totals are derived by the use case from the appointment snapshot. */
export interface RecordCashCaptureData {
  appointmentId: string;
  businessCustomerId: string;
  subtotalAmount: string;
  discountAmount: string;
  taxAmount: string;
  tipAmount: string;
  totalAmount: string;
  currency: string;
  /** Client-paid amount (≤ remaining). */
  amount: string;
  processedAt: Date;
  metadata?: Record<string, unknown> | undefined;
}

/** Cash refund inputs. */
export interface RecordRefundData {
  paymentId: string;
  amount: string;
  reason: string | null;
  processedBy: string | null;
  processedAt: Date;
  metadata?: Record<string, unknown> | undefined;
}

export interface PaymentFilters {
  status?: PaymentSummaryEntity['status'] | undefined;
  fromDate?: Date | undefined;
  toDate?: Date | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface PaymentListResult {
  payments: PaymentSummaryEntity[];
  total: number;
}

export interface IPaymentRepository {
  /** Full payment aggregate (transactions + refunds) for an appointment, or null. */
  getByAppointment(businessId: string, appointmentId: string): Promise<PaymentEntity | null>;

  /** Full payment aggregate by id within the tenant boundary, or null. */
  getById(businessId: string, paymentId: string): Promise<PaymentEntity | null>;

  /** Tenant-scoped, paginated summary list. */
  findAll(businessId: string, filters: PaymentFilters): Promise<PaymentListResult>;

  /**
   * Atomically records a cash capture and updates the enclosing payment aggregate.
   * Creates the payment row on first capture. Throws ConflictError on overpayment
   * or concurrent double-capture (appointment unique). Uses SELECT ... FOR UPDATE
   * so two parallel captures cannot silently undercount captured money.
   */
  recordCapture(businessId: string, data: RecordCashCaptureData): Promise<PaymentEntity>;

  /**
   * Atomically records a refund against a captured transaction and updates the
   * enclosing payment aggregate. Throws ConflictError if refund exceeds the
   * captured-but-not-yet-refunded balance.
   */
  recordRefund(businessId: string, data: RecordRefundData): Promise<PaymentEntity>;
}
