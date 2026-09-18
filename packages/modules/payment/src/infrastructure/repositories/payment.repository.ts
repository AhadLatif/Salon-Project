import { type Database, payments, paymentTransactions, refunds } from '@salon/database';
import { ConflictError, extractPostgresError, ResourceNotFoundError } from '@salon/shared';
import { and, count, eq, gte, inArray, lte } from 'drizzle-orm';
import type {
  IPaymentRepository,
  PaymentFilters,
  PaymentListResult,
  RecordCashCaptureData,
  RecordRefundData,
} from '../../application/ports/payment-repository.port.js';
import type { PaymentEntity, PaymentSummaryEntity } from '../../domain/entities/payment.entity.js';
import { sumMoney, toMinorUnits } from '../../domain/services/payment-amount.js';

/**
 * Drizzle implementation of `IPaymentRepository`.
 *
 * Writes ONLY to payment-owned tables (payments, payment_transactions, refunds) —
 * the strict module-isolation invariant. Money totals are never read from
 * appointments here; the use case derives them from an appointment snapshot
 * fetched through the appointment domain port.
 *
 * Concurrency: every capture/refund locks the parent payment row via a guarded
 * UPDATE, so parallel captures serialize and cannot undercount money. The
 * unique `uq_payments_appointment` index on appointment_id is the final guard
 * against a racing first-capture creating duplicate payment rows (23505 → ConflictError).
 *
 * Aggregations count only finalized rows: a transaction contributes to balances
 * only while `captured` (pending/failed/cancelled are excluded), and a refund
 * counts only while `completed`.
 */
export class PaymentRepository implements IPaymentRepository {
  constructor(private readonly db: Database) {}

  async getByAppointment(businessId: string, appointmentId: string): Promise<PaymentEntity | null> {
    const paymentRow = await this.db.query.payments.findFirst({
      where: and(eq(payments.businessId, businessId), eq(payments.appointmentId, appointmentId)),
    });
    if (!paymentRow) return null;
    return this.loadEntity(businessId, paymentRow.id);
  }

  async getById(businessId: string, paymentId: string): Promise<PaymentEntity | null> {
    const paymentRow = await this.db.query.payments.findFirst({
      where: and(eq(payments.businessId, businessId), eq(payments.id, paymentId)),
    });
    if (!paymentRow) return null;
    return this.loadEntity(businessId, paymentRow.id);
  }

  async findAll(businessId: string, filters: PaymentFilters): Promise<PaymentListResult> {
    const conditions = [eq(payments.businessId, businessId)];
    if (filters.status) conditions.push(eq(payments.status, filters.status));
    if (filters.fromDate) conditions.push(gte(payments.paidAt, filters.fromDate));
    if (filters.toDate) conditions.push(lte(payments.paidAt, filters.toDate));

    const limit = Math.min(filters.limit ?? 50, 100);
    const offset = Math.max(filters.offset ?? 0, 0);

    const totalRow = await this.db
      .select({ total: count() })
      .from(payments)
      .where(and(...conditions));
    const total = totalRow[0]?.total ?? 0;

    const rows = await this.db.query.payments.findMany({
      where: and(...conditions),
      orderBy: (p, { desc: d }) => [d(p.createdAt)],
      limit,
      offset,
    });
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return { payments: [], total };

    // Only captured transactions count toward the captured balance.
    const txRows = await this.db
      .select({
        id: paymentTransactions.id,
        paymentId: paymentTransactions.paymentId,
        amount: paymentTransactions.amount,
      })
      .from(paymentTransactions)
      .where(
        and(
          inArray(paymentTransactions.paymentId, ids),
          eq(paymentTransactions.status, 'captured'),
        ),
      );
    const capturedByPayment = new Map<string, string>();
    const txnIdToPaymentId = new Map<string, string>();
    for (const r of txRows) {
      capturedByPayment.set(
        r.paymentId,
        sumMoney([capturedByPayment.get(r.paymentId) ?? '0.00', r.amount]),
      );
      txnIdToPaymentId.set(r.id, r.paymentId);
    }
    const txnIds = txRows.map((r) => r.id);
    // Only completed refunds count toward the refunded balance.
    const refundRows = txnIds.length
      ? await this.db
          .select({ paymentTransactionId: refunds.paymentTransactionId, amount: refunds.amount })
          .from(refunds)
          .where(
            and(inArray(refunds.paymentTransactionId, txnIds), eq(refunds.status, 'completed')),
          )
      : [];
    const refundByPayment = new Map<string, string>();
    for (const r of refundRows) {
      const pid = txnIdToPaymentId.get(r.paymentTransactionId);
      if (!pid) continue;
      refundByPayment.set(pid, sumMoney([refundByPayment.get(pid) ?? '0.00', r.amount]));
    }

    const summaries: PaymentSummaryEntity[] = rows.map((row) => ({
      id: row.id,
      appointmentId: row.appointmentId,
      status: row.status,
      currency: row.currency,
      totalAmount: row.totalAmount,
      subtotalAmount: row.subtotalAmount,
      paidAt: row.paidAt,
      createdAt: row.createdAt,
      capturedAmount: capturedByPayment.get(row.id) ?? '0.00',
      refundedAmount: refundByPayment.get(row.id) ?? '0.00',
    }));

    return { payments: summaries, total };
  }

  async recordCapture(businessId: string, data: RecordCashCaptureData): Promise<PaymentEntity> {
    try {
      return await this.recordCaptureTx(businessId, data);
    } catch (error: unknown) {
      // A racing first-capture for the same appointment hits uq_payments_appointment
      // (23505). Surface as a clean, retryable conflict rather than a raw PG error.
      const dbErr = extractPostgresError(error);
      if (dbErr?.code === '23505') {
        throw new ConflictError(
          'This appointment already has a payment record. Retry the capture to continue.',
        );
      }
      throw error;
    }
  }

  private async recordCaptureTx(
    businessId: string,
    data: RecordCashCaptureData,
  ): Promise<PaymentEntity> {
    return await this.db.transaction(async (tx) => {
      const now = data.processedAt;

      // 1. Find or create the payment row for this appointment.
      const existingRow = await tx.query.payments.findFirst({
        where: and(
          eq(payments.businessId, businessId),
          eq(payments.appointmentId, data.appointmentId),
        ),
      });
      const paymentRow =
        existingRow ??
        (await (async () => {
          const [created] = await tx
            .insert(payments)
            .values({
              businessId,
              appointmentId: data.appointmentId,
              currency: data.currency,
              status: 'unpaid',
              subtotalAmount: data.subtotalAmount,
              discountAmount: data.discountAmount,
              taxAmount: data.taxAmount,
              tipAmount: data.tipAmount,
              totalAmount: data.totalAmount,
            })
            .returning();
          if (!created) throw new Error('Failed to create payment record.');
          return created;
        })());

      // Single source of truth: the stored total must match the incoming total.
      // A mismatch means the appointment snapshot changed between partial captures.
      if (data.totalAmount !== paymentRow.totalAmount) {
        throw new ConflictError(
          'The appointment total has changed since this payment was started. Please retry with the current total.',
        );
      }
      const totalMinor = toMinorUnits(paymentRow.totalAmount);

      // 2. Lock the parent row so parallel captures serialize (FOR UPDATE via UPDATE).
      const [locked] = await tx
        .update(payments)
        .set({ updatedAt: now })
        .where(eq(payments.id, paymentRow.id))
        .returning();
      if (!locked) throw new ConflictError('Payment row could not be locked for capture.');

      // 3. Sum already-captured amounts (captured status only) and reject overpayment.
      const capturedRows = await tx.query.paymentTransactions.findMany({
        where: and(
          eq(paymentTransactions.businessId, businessId),
          eq(paymentTransactions.paymentId, paymentRow.id),
          eq(paymentTransactions.status, 'captured'),
        ),
      });
      const capturedMinor = toMinorUnits(sumMoney(capturedRows.map((r) => r.amount)));
      const amountMinor = toMinorUnits(data.amount);
      if (capturedMinor + amountMinor > totalMinor) {
        throw new ConflictError(
          'Payment amount exceeds the remaining balance for this appointment.',
        );
      }

      // 4. Insert the cash capture transaction.
      const [txn] = await tx
        .insert(paymentTransactions)
        .values({
          businessId,
          appointmentId: data.appointmentId,
          businessCustomerId: data.businessCustomerId,
          paymentId: paymentRow.id,
          method: 'cash',
          status: 'captured',
          amount: data.amount,
          processedAt: now,
          metadata: data.metadata ?? null,
        })
        .returning();
      if (!txn) throw new Error('Failed to record cash capture transaction.');

      // 5. Derive payment status from captured totals.
      const newStatus = capturedMinor + amountMinor >= totalMinor ? 'paid' : 'partially_paid';
      await tx
        .update(payments)
        .set({ status: newStatus, paidAt: newStatus === 'paid' ? now : null, updatedAt: now })
        .where(eq(payments.id, paymentRow.id));

      return this.loadEntity(businessId, paymentRow.id, tx as unknown as Database);
    });
  }

  async recordRefund(businessId: string, data: RecordRefundData): Promise<PaymentEntity> {
    return await this.db.transaction(async (tx) => {
      const now = data.processedAt;

      const paymentRow = await tx.query.payments.findFirst({
        where: and(eq(payments.businessId, businessId), eq(payments.id, data.paymentId)),
      });
      if (!paymentRow) {
        throw new ResourceNotFoundError(`Payment ${data.paymentId} not found in this business`);
      }
      const [locked] = await tx
        .update(payments)
        .set({ updatedAt: now })
        .where(eq(payments.id, paymentRow.id))
        .returning();
      if (!locked) throw new ConflictError('Payment row could not be locked for refund.');

      // Attach the refund to the most recent captured cash transaction.
      const txn = await tx.query.paymentTransactions.findFirst({
        where: and(
          eq(paymentTransactions.businessId, businessId),
          eq(paymentTransactions.paymentId, paymentRow.id),
          eq(paymentTransactions.method, 'cash'),
          eq(paymentTransactions.status, 'captured'),
        ),
        orderBy: (t, { desc: d }) => [d(t.processedAt), d(t.createdAt)],
      });
      if (!txn) throw new ConflictError('No captured cash transaction exists to refund.');

      // Refund must be <= total captured (across all captured transactions) minus
      // total already refunded (across all completed refunds). Bounding by a single
      // transaction would prevent refunding the full amount when cash was collected
      // in multiple partial captures.
      const allCapturedTx = await tx.query.paymentTransactions.findMany({
        where: and(
          eq(paymentTransactions.businessId, businessId),
          eq(paymentTransactions.paymentId, paymentRow.id),
          eq(paymentTransactions.status, 'captured'),
        ),
      });
      const totalCaptured = toMinorUnits(sumMoney(allCapturedTx.map((r) => r.amount)));
      const allTxnIds = allCapturedTx.map((r) => r.id);
      const allRefunds = allTxnIds.length
        ? await tx.query.refunds.findMany({
            where: and(
              inArray(refunds.paymentTransactionId, allTxnIds),
              eq(refunds.status, 'completed'),
            ),
          })
        : [];
      const totalRefunded = toMinorUnits(sumMoney(allRefunds.map((r) => r.amount)));
      if (toMinorUnits(data.amount) > totalCaptured - totalRefunded) {
        throw new ConflictError('Refund amount exceeds the available refundable balance.');
      }

      // Cash refunds have no external provider id, so `gateway` and `gatewayRefundId` are
      // deliberately left NULL here.
      //
      // Any future GATEWAY refund (e.g. Stripe) must set BOTH of them together.
      // `uq_refunds_gateway` is keyed on (gateway, gateway_refund_id), so writing a refund id
      // without its gateway would drop the row into the '__drizzle_null__' bucket, where it
      // would collide with unrelated cash refunds instead of being scoped to its provider.
      await tx.insert(refunds).values({
        businessId,
        paymentTransactionId: txn.id,
        status: 'completed',
        amount: data.amount,
        reason: data.reason,
        processedBy: data.processedBy ?? null,
        processedAt: now,
        metadata: data.metadata ?? null,
      });

      // Recompute payment status from the same captured totals plus the refund
      // just inserted (totalRefunded was computed before the insert, so it does
      // not yet include this refund).
      const capturedTotal = totalCaptured;
      const refundedTotal = totalRefunded + toMinorUnits(data.amount);
      const totalAmountMinor = toMinorUnits(paymentRow.totalAmount);

      const newStatus: PaymentEntity['status'] =
        refundedTotal >= capturedTotal
          ? 'refunded'
          : refundedTotal > 0
            ? 'partially_refunded'
            : capturedTotal >= totalAmountMinor
              ? 'paid'
              : 'partially_paid';

      await tx
        .update(payments)
        .set({
          status: newStatus,
          paidAt: capturedTotal > 0 ? locked.paidAt : null,
          updatedAt: now,
        })
        .where(eq(payments.id, paymentRow.id));

      return this.loadEntity(businessId, paymentRow.id, tx as unknown as Database);
    });
  }

  /**
   * Loads a full payment aggregate (transactions + refunds) within a tenant.
   *
   * Accepts an optional database/transaction handle so it can run inside an active
   * transaction and see uncommitted changes (e.g. a just-inserted capture). Defaults
   * to the repository's own db handle for standalone reads.
   */
  private async loadEntity(
    businessId: string,
    paymentId: string,
    db: Database = this.db,
  ): Promise<PaymentEntity> {
    const paymentRow = await db.query.payments.findFirst({
      where: and(eq(payments.businessId, businessId), eq(payments.id, paymentId)),
    });
    if (!paymentRow)
      throw new ResourceNotFoundError(`Payment ${paymentId} not found in this business`);

    const txRows = await db.query.paymentTransactions.findMany({
      where: and(
        eq(paymentTransactions.businessId, businessId),
        eq(paymentTransactions.paymentId, paymentId),
      ),
      orderBy: (t, { asc: a }) => [a(t.processedAt), a(t.createdAt)],
    });
    const txnIds = txRows.map((r) => r.id);
    const refundRows = txnIds.length
      ? await db.query.refunds.findMany({
          where: and(
            eq(refunds.businessId, businessId),
            inArray(refunds.paymentTransactionId, txnIds),
          ),
        })
      : [];

    return {
      id: paymentRow.id,
      businessId: paymentRow.businessId,
      appointmentId: paymentRow.appointmentId,
      status: paymentRow.status,
      currency: paymentRow.currency,
      subtotalAmount: paymentRow.subtotalAmount,
      discountAmount: paymentRow.discountAmount,
      taxAmount: paymentRow.taxAmount,
      tipAmount: paymentRow.tipAmount,
      totalAmount: paymentRow.totalAmount,
      paidAt: paymentRow.paidAt,
      createdAt: paymentRow.createdAt,
      updatedAt: paymentRow.updatedAt,
      transactions: txRows.map((r) => ({
        id: r.id,
        businessId: r.businessId,
        appointmentId: r.appointmentId,
        businessCustomerId: r.businessCustomerId,
        paymentId: r.paymentId,
        method: r.method,
        status: r.status,
        amount: r.amount,
        gateway: r.gateway,
        gatewayTransactionId: r.gatewayTransactionId,
        gatewayReference: r.gatewayReference,
        processedAt: r.processedAt,
        failureReason: r.failureReason,
        metadata: r.metadata,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      refunds: refundRows.map((r) => ({
        id: r.id,
        businessId: r.businessId,
        paymentTransactionId: r.paymentTransactionId,
        status: r.status,
        amount: r.amount,
        reason: r.reason,
        processedBy: r.processedBy,
        gatewayRefundId: r.gatewayRefundId,
        gatewayReference: r.gatewayReference,
        processedAt: r.processedAt,
        failureReason: r.failureReason,
        metadata: r.metadata,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    };
  }
}
