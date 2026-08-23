import { ConflictError, ResourceNotFoundError, ValidationError } from '@salon/shared';
import type { BusinessCustomerEntity } from '../../domain/entities/customer.entity.js';
import type { ICustomerRepository, UpdateCustomerData } from '../ports/customer-repository.port.js';

export class UpdateCustomerUseCase {
  constructor(private readonly customerRepository: ICustomerRepository) {}

  /**
   * Updates mutable fields on a customer profile.
   *
   * Business Rules:
   * 1. Cannot update archived customer profiles.
   * 2. Merged State Contact Invariant: Profile must still retain at least an email or phone number after updates.
   * 3. Email Uniqueness: If changing email, ensures no other customer in the business has that email.
   */
  async execute(
    businessId: string,
    customerId: string,
    data: UpdateCustomerData,
  ): Promise<BusinessCustomerEntity> {
    const existing = await this.customerRepository.findById(businessId, customerId);
    if (!existing) {
      throw new ResourceNotFoundError('Customer not found in this business');
    }

    if (existing.status === 'archived') {
      throw new ConflictError('Cannot update an archived customer profile');
    }

    // Determine final merged contact state
    const targetEmail =
      data.email !== undefined
        ? data.email
          ? data.email.trim().toLowerCase()
          : null
        : existing.email;

    const targetPhone =
      data.phoneNumber !== undefined
        ? data.phoneNumber
          ? data.phoneNumber.trim()
          : null
        : existing.phoneNumber;

    if (!targetEmail && !targetPhone) {
      throw new ValidationError(
        'Customer profile must retain at least one valid contact method (email or phone number)',
      );
    }

    // Check email uniqueness if email was modified
    if (targetEmail && targetEmail !== existing.email) {
      const emailConflict = await this.customerRepository.findByEmail(businessId, targetEmail);
      if (emailConflict && emailConflict.id !== customerId) {
        throw new ConflictError(
          'A customer with this email address already exists in this salon directory',
        );
      }
    }

    const updated = await this.customerRepository.update(businessId, customerId, {
      ...data,
      email: targetEmail,
      phoneNumber: targetPhone,
    });

    if (!updated) {
      throw new ResourceNotFoundError('Customer not found during update');
    }

    return updated;
  }
}
