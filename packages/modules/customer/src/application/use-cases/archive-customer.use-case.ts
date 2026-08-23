import { ConflictError, ResourceNotFoundError } from '@salon/shared';
import type { BusinessCustomerEntity } from '../../domain/entities/customer.entity.js';
import type { ICustomerRepository } from '../ports/customer-repository.port.js';

export class ArchiveCustomerUseCase {
  constructor(private readonly customerRepository: ICustomerRepository) {}

  /**
   * Soft-archives a customer profile by transitioning status from 'active' to 'archived'.
   */
  async execute(businessId: string, customerId: string): Promise<BusinessCustomerEntity> {
    const existing = await this.customerRepository.findById(businessId, customerId);
    if (!existing) {
      throw new ResourceNotFoundError('Customer not found in this business');
    }

    if (existing.status === 'archived') {
      throw new ConflictError('Customer profile is already archived');
    }

    const archived = await this.customerRepository.archive(businessId, customerId);
    if (!archived) {
      throw new ResourceNotFoundError('Customer not found during archive');
    }

    return archived;
  }
}
