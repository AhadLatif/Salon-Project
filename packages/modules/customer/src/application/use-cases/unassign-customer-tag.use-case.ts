import { ResourceNotFoundError } from '@salon/shared';
import type {
  ICustomerRepository,
  ICustomerTagRepository,
} from '../ports/customer-repository.port.js';

export class UnassignCustomerTagUseCase {
  constructor(
    private readonly customerRepository: ICustomerRepository,
    private readonly customerTagRepository: ICustomerTagRepository,
  ) {}

  /**
   * Removes a tag assignment from a customer profile.
   */
  async execute(businessId: string, customerId: string, tagId: string): Promise<boolean> {
    const customer = await this.customerRepository.findById(businessId, customerId);
    if (!customer) {
      throw new ResourceNotFoundError('Customer not found in this business');
    }

    const unassigned = await this.customerTagRepository.unassignTag(businessId, customerId, tagId);
    if (!unassigned) {
      throw new ResourceNotFoundError('Customer does not have this tag assigned');
    }

    return true;
  }
}
