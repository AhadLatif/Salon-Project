import { ConflictError, ForbiddenError, ResourceNotFoundError } from '@salon/shared';
import type { PaymentEntity } from '../../domain/entities/payment.entity.js';
import {
  fromMinorUnits,
  gtMoney,
  isPositiveMoney,
  sumMoney,
  toMinorUnits,
} from '../../domain/services/payment-amount.js';
import type { IPaymentAppointmentService } from '../ports/appointment-service.port.js';
import type { IBusinessMemberValidator } from '../ports/business-member-validator.port.js';
import type { IPaymentRepository } from '../ports/payment-repository.port.js';

export interface CaptureCashPaymentData {
  businessId: string;
  appointmentId: string;
  branchId?: string | undefined;
  /** Optional cash amount; when omitted the full outstanding balance is captured. */
  amount?: string | null | undefined;
  actorUserId?: string | null | undefined;
  actorBusinessMemberId?: string | null | undefined;
}

/**
 * Cash capture, the core Fresha POS "checkout" action.
 *
 * Flow:
 *  1. Verify the recorded-by business member belongs to the tenant.
 *  2. Pull the appointment snapshot via the appointment domain port (isolated —
 *     no payment SQL against appointment tables).
 *  3. Derive the authoritative totals from the appointment's immutable service
 *     unit prices (subtotal; discount/tax/tip are zero in the cash MVP). The
 *     client NEVER sends a total — only an optional partial amount.
 *  4. Guard: a terminal appointment (cancelled/no_show) cannot be paid.
 *  5. Record the capture atomically (FOR UPDATE) in the payment repository.
 *  6. If the payment is now fully paid, mark the appointment completed via the
 *     appointment port (best-effort — the money is already recorded).
 */
export class CaptureCashPaymentUseCase {
  constructor(
    private readonly paymentRepository: IPaymentRepository,
    private readonly appointmentService: IPaymentAppointmentService,
    private readonly businessMemberValidator: IBusinessMemberValidator,
  ) {}

  async execute(data: CaptureCashPaymentData): Promise<PaymentEntity> {
    // ── 1. Actor membership ────────────────────────────────────────────────
    const memberId = data.actorBusinessMemberId;
    if (
      memberId &&
      !(await this.businessMemberValidator.isBusinessMemberInBusiness(data.businessId, memberId))
    ) {
      throw new ForbiddenError('Business member does not belong to this business');
    }

    // ── 2. Appointment snapshot via domain port ─────────────────────────────
    const snapshot = await this.appointmentService.getPaymentSnapshot(
      data.businessId,
      data.appointmentId,
    );
    if (!snapshot) {
      throw new ResourceNotFoundError(
        `Appointment ${data.appointmentId} not found in this business`,
      );
    }

    // ── 3. Terminal guard ───────────────────────────────────────────────────
    if (snapshot.status === 'cancelled' || snapshot.status === 'no_show') {
      throw new ConflictError(
        `Cannot capture payment for an appointment in terminal status "${snapshot.status}".`,
      );
    }

    // ── 4. Derive authoritative totals from service unit prices ────────────
    const subtotalAmount = sumMoney(snapshot.segments.map((s) => s.unitPrice));
    const discountAmount = '0.00';
    const taxAmount = '0.00';
    const tipAmount = '0.00';
    const totalAmount = subtotalAmount; // no discount/tax/tip in the cash MVP

    // ── 5. Resolve the capture amount (default: full outstanding balance) ───
    let amount = data.amount?.trim() || null;
    if (amount === null) {
      // Read current captured balance to default to the remaining amount.
      const existing = await this.paymentRepository.getByAppointment(
        data.businessId,
        data.appointmentId,
      );
      const captured = existing
        ? toMinorUnits(sumMoney(existing.transactions.map((t) => t.amount)))
        : 0;
      amount = fromMinorUnits(Math.max(0, toMinorUnits(totalAmount) - captured));
    }
    if (!isPositiveMoney(amount)) {
      throw new ConflictError('Payment amount must be greater than zero.');
    }
    if (gtMoney(amount, totalAmount)) {
      throw new ConflictError('Payment amount cannot exceed the appointment total.');
    }

    // ── 6. Atomically record the capture ────────────────────────────────────
    const payment = await this.paymentRepository.recordCapture(data.businessId, {
      appointmentId: data.appointmentId,
      businessCustomerId: snapshot.businessCustomerId,
      subtotalAmount,
      discountAmount,
      taxAmount,
      tipAmount,
      totalAmount,
      currency: 'PKR',
      amount,
      processedAt: new Date(),
      metadata: { actorUserId: data.actorUserId ?? null },
    });

    // ── 7. Fully paid → complete the appointment (best-effort) ──────────────
    if (payment.status === 'paid') {
      try {
        await this.appointmentService.completeAsPaid(data.businessId, data.appointmentId, {
          branchId: data.branchId,
          actorUserId: data.actorUserId,
          actorBusinessMemberId: data.actorBusinessMemberId,
        });
      } catch (err) {
        // Money is already captured; if a concurrent actor terminalized the
        // appointment, completion is skipped rather than rolling back payment.
        // Only swallow expected terminal-state conflicts — real errors (bugs,
        // DB failures) must surface so the client knows something went wrong.
        if (err instanceof ConflictError) {
          return payment;
        }
        throw err;
      }
    }

    return payment;
  }
}
