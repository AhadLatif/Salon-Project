import { ResourceNotFoundError } from '@salon/shared';
import type { CustomerNoteEntity } from '../../domain/entities/customer-note.entity.js';
import type {
  ICustomerNoteRepository,
  ICustomerRepository,
} from '../ports/customer-repository.port.js';

export class GetCustomerNotesUseCase {
  constructor(
    private readonly customerRepository: ICustomerRepository,
    private readonly customerNoteRepository: ICustomerNoteRepository,
  ) {}

  /**
   * Retrieves all internal notes for a customer profile.
   */
  async execute(businessId: string, customerId: string): Promise<CustomerNoteEntity[]> {
    const customer = await this.customerRepository.findById(businessId, customerId);
    if (!customer) {
      throw new ResourceNotFoundError('Customer not found in this business');
    }

    return this.customerNoteRepository.findAllByCustomerId(businessId, customerId);
  }
}
