import { ResourceNotFoundError } from '@salon/shared';
import type { PaymentEntity } from '../../domain/entities/payment.entity.js';
import type { IPaymentRepository } from '../ports/payment-repository.port.js';

/** Fetches one full payment aggregate (transactions + refunds) within the tenant. */
export class GetPaymentDetailUseCase {
  constructor(private readonly paymentRepository: IPaymentRepository) {}

  async execute(businessId: string, paymentId: string): Promise<PaymentEntity> {
    const payment = await this.paymentRepository.getById(businessId, paymentId);
    if (!payment) {
      throw new ResourceNotFoundError(`Payment ${paymentId} not found in this business`);
    }
    return payment;
  }

  /** Fetches the payment aggregate for an appointment, throwing 404 when none exists. */
  async executeByAppointment(businessId: string, appointmentId: string): Promise<PaymentEntity> {
    const payment = await this.paymentRepository.getByAppointment(businessId, appointmentId);
    if (!payment) {
      throw new ResourceNotFoundError(
        `No payment recorded for appointment ${appointmentId} in this business`,
      );
    }
    return payment;
  }
}
