import { ResourceNotFoundError } from '@salon/shared';
import type { ICustomerNoteRepository } from '../ports/customer-repository.port.js';

export class DeleteCustomerNoteUseCase {
  constructor(private readonly customerNoteRepository: ICustomerNoteRepository) {}

  /**
   * Deletes a customer note under tenant & customer isolation boundaries.
   */
  async execute(businessId: string, customerId: string, noteId: string): Promise<boolean> {
    const deleted = await this.customerNoteRepository.delete(businessId, customerId, noteId);
    if (!deleted) {
      throw new ResourceNotFoundError('Customer note not found in this business');
    }

    return true;
  }
}
