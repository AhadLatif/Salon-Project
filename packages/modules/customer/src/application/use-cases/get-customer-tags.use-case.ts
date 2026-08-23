import type { CustomerTagEntity } from '../../domain/entities/customer-tag.entity.js';
import type { ICustomerTagRepository } from '../ports/customer-repository.port.js';

export class GetCustomerTagsUseCase {
  constructor(private readonly customerTagRepository: ICustomerTagRepository) {}

  /**
   * Retrieves all defined tags for a business.
   */
  async execute(businessId: string): Promise<CustomerTagEntity[]> {
    return this.customerTagRepository.findAll(businessId);
  }
}
