import { ResourceNotFoundError } from '@salon/shared';
import type { ICustomerTagRepository } from '../ports/customer-repository.port.js';

export class DeleteCustomerTagUseCase {
  constructor(private readonly customerTagRepository: ICustomerTagRepository) {}

  /**
   * Deletes a customer tag from the business catalog.
   * Database foreign key constraints cascade and remove associated customer tag assignments.
   */
  async execute(businessId: string, tagId: string): Promise<boolean> {
    const deleted = await this.customerTagRepository.delete(businessId, tagId);
    if (!deleted) {
      throw new ResourceNotFoundError('Customer tag not found in this business');
    }

    return true;
  }
}
