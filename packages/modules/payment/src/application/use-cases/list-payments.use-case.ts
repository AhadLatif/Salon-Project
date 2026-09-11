import type {
  IPaymentRepository,
  PaymentFilters,
  PaymentListResult,
} from '../ports/payment-repository.port.js';

/** Lists payments for a business with optional status/date filtering + pagination. */
export class ListPaymentsUseCase {
  constructor(private readonly paymentRepository: IPaymentRepository) {}

  async execute(businessId: string, filters: PaymentFilters): Promise<PaymentListResult> {
    return await this.paymentRepository.findAll(businessId, filters);
  }
}
