import { ConflictError } from '@salon/shared';
import type { CustomerTagEntity } from '../../domain/entities/customer-tag.entity.js';
import type {
  CreateCustomerTagData,
  ICustomerTagRepository,
} from '../ports/customer-repository.port.js';

export class CreateCustomerTagUseCase {
  constructor(private readonly customerTagRepository: ICustomerTagRepository) {}

  /**
   * Creates a business tag definition for customer segmentation.
   * Ensures tag name uniqueness per salon business.
   */
  async execute(data: CreateCustomerTagData): Promise<CustomerTagEntity> {
    const existing = await this.customerTagRepository.findByName(data.businessId, data.name);
    if (existing) {
      throw new ConflictError(
        'A customer tag with this name already exists in this salon business',
      );
    }

    return this.customerTagRepository.create(data);
  }
}
