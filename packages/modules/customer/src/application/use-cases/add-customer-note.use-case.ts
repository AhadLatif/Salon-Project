import { ResourceNotFoundError, ValidationError } from '@salon/shared';
import type { CustomerNoteEntity } from '../../domain/entities/customer-note.entity.js';
import type {
  CreateCustomerNoteData,
  ICustomerNoteRepository,
  ICustomerRepository,
} from '../ports/customer-repository.port.js';

export class AddCustomerNoteUseCase {
  constructor(
    private readonly customerRepository: ICustomerRepository,
    private readonly customerNoteRepository: ICustomerNoteRepository,
  ) {}

  /**
   * Appends an internal CRM note stamped with author membership context.
   */
  async execute(data: CreateCustomerNoteData): Promise<CustomerNoteEntity> {
    if (!data.note || data.note.trim().length === 0) {
      throw new ValidationError('Customer note text cannot be empty');
    }

    const customer = await this.customerRepository.findById(
      data.businessId,
      data.businessCustomerId,
    );
    if (!customer) {
      throw new ResourceNotFoundError('Customer not found in this business');
    }

    return this.customerNoteRepository.create({
      ...data,
      note: data.note.trim(),
    });
  }
}
