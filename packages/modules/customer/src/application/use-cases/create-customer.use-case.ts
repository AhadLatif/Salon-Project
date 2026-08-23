import { ConflictError, ValidationError } from '@salon/shared';
import type { BusinessCustomerEntity } from '../../domain/entities/customer.entity.js';
import type { CreateCustomerData, ICustomerRepository } from '../ports/customer-repository.port.js';

export class CreateCustomerUseCase {
  constructor(private readonly customerRepository: ICustomerRepository) {}

  /**
   * Onboards a customer profile into the salon CRM.
   *
   * Business Rules:
   * 1. Contact Invariant: At least one contact channel (email OR phoneNumber) must be provided.
   * 2. Tenant Email Uniqueness: A business cannot have duplicate customer emails in its CRM.
   */
  async execute(data: CreateCustomerData): Promise<BusinessCustomerEntity> {
    const trimmedEmail = data.email ? data.email.trim().toLowerCase() : null;
    const trimmedPhone = data.phoneNumber ? data.phoneNumber.trim() : null;

    if (!trimmedEmail && !trimmedPhone) {
      throw new ValidationError('Customer profile must include at least an email or phone number');
    }

    if (trimmedEmail) {
      const existing = await this.customerRepository.findByEmail(data.businessId, trimmedEmail);
      if (existing) {
        throw new ConflictError(
          'A customer with this email address already exists in this salon directory',
        );
      }
    }

    return this.customerRepository.create({
      ...data,
      email: trimmedEmail,
      phoneNumber: trimmedPhone,
    });
  }
}
