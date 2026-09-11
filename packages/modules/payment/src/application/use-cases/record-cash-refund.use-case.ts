import { ConflictError, ForbiddenError } from '@salon/shared';
import type { PaymentEntity } from '../../domain/entities/payment.entity.js';
import { isPositiveMoney } from '../../domain/services/payment-amount.js';
import type { IBusinessMemberValidator } from '../ports/business-member-validator.port.js';
import type { IPaymentRepository } from '../ports/payment-repository.port.js';

export interface RecordCashRefundData {
  businessId: string;
  paymentId: string;
  amount: string;
  reason?: string | null | undefined;
  actorBusinessMemberId?: string | null | undefined;
}

/**
 * Issues a cash refund against a captured payment.
 *
 * Verifies the authorizing business member belongs to the tenant, enforces a
 * positive amount, and delegates the atomic balance re-check (refund ≤ captured -
 * already-refunded) to the payment repository's recordRefund (FOR UPDATE).
 * A fully refunded payment flips to `refunded`, otherwise `partially_refunded`.
 */
export class RecordCashRefundUseCase {
  constructor(
    private readonly paymentRepository: IPaymentRepository,
    private readonly businessMemberValidator: IBusinessMemberValidator,
  ) {}

  async execute(data: RecordCashRefundData): Promise<PaymentEntity> {
    const memberId = data.actorBusinessMemberId;
    if (
      memberId &&
      !(await this.businessMemberValidator.isBusinessMemberInBusiness(data.businessId, memberId))
    ) {
      throw new ForbiddenError('Business member does not belong to this business');
    }

    const amount = data.amount.trim();
    if (!isPositiveMoney(amount)) {
      throw new ConflictError('Refund amount must be greater than zero.');
    }

    return await this.paymentRepository.recordRefund(data.businessId, {
      paymentId: data.paymentId,
      amount,
      reason: data.reason ?? null,
      processedBy: memberId ?? null,
      processedAt: new Date(),
    });
  }
}
