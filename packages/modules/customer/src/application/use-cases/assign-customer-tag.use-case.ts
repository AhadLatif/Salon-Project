import { ResourceNotFoundError } from '@salon/shared';
import type { CustomerTagAssignmentEntity } from '../../domain/entities/customer-tag.entity.js';
import type {
  ICustomerRepository,
  ICustomerTagRepository,
} from '../ports/customer-repository.port.js';

export class AssignCustomerTagUseCase {
  constructor(
    private readonly customerRepository: ICustomerRepository,
    private readonly customerTagRepository: ICustomerTagRepository,
  ) {}

  /**
   * Idempotently assigns a tag to a customer profile.
   */
  async execute(
    businessId: string,
    customerId: string,
    tagId: string,
    assignedBy?: string | null,
  ): Promise<CustomerTagAssignmentEntity> {
    const customer = await this.customerRepository.findById(businessId, customerId);
    if (!customer) {
      throw new ResourceNotFoundError('Customer not found in this business');
    }

    const tag = await this.customerTagRepository.findById(businessId, tagId);
    if (!tag) {
      throw new ResourceNotFoundError('Tag not found in this business');
    }

    return this.customerTagRepository.assignTag(businessId, customerId, tagId, assignedBy);
  }
}
