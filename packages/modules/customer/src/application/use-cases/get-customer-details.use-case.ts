import { ResourceNotFoundError } from '@salon/shared';
import type { CustomerWithTagsEntity } from '../../domain/entities/customer.entity.js';
import type { ICustomerRepository } from '../ports/customer-repository.port.js';

export class GetCustomerDetailsUseCase {
  constructor(private readonly customerRepository: ICustomerRepository) {}

  /**
   * Retrieves customer profile information and assigned CRM tags.
   */
  async execute(businessId: string, customerId: string): Promise<CustomerWithTagsEntity> {
    const customer = await this.customerRepository.findDetailsById(businessId, customerId);
    if (!customer) {
      throw new ResourceNotFoundError('Customer not found in this business');
    }

    return customer;
  }
}
