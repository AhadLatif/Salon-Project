import type {
  GetCustomersFilter,
  ICustomerRepository,
  PaginatedCustomers,
} from '../ports/customer-repository.port.js';

export class GetCustomersUseCase {
  constructor(private readonly customerRepository: ICustomerRepository) {}

  /**
   * Retrieves a paginated list of customers for a business with optional search/tag/status filters.
   */
  async execute(businessId: string, filter?: GetCustomersFilter): Promise<PaginatedCustomers> {
    return this.customerRepository.findAll(businessId, filter);
  }
}
