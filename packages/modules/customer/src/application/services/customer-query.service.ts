import type { BusinessCustomerEntity } from '../../domain/entities/customer.entity.js';
import type { ICustomerRepository } from '../ports/customer-repository.port.js';

/**
 * CROSS-MODULE CUSTOMER QUERY CONTRACT
 *
 * Exposes pure read-only customer query methods to downstream modules
 * (e.g. Appointment booking verification, Review authorship).
 *
 * Invariant:
 * Write operations and profile lifecycle modifications are never exposed through
 * this query contract; downstream modules must invoke dedicated domain use cases.
 */
export interface ICustomerQueryService {
  /**
   * Fast existence check verifying whether an active customer profile belongs to a business.
   * Used by appointment booking to validate the customer before scheduling.
   *
   * @param businessId - Business tenant ID (UUID)
   * @param customerId - Business customer profile ID (UUID)
   * @returns `true` if customer exists, belongs to tenant, and is active; otherwise `false`
   */
  isCustomerInBusiness(businessId: string, customerId: string): Promise<boolean>;

  /**
   * Retrieves a customer profile by ID within a business tenant boundary.
   *
   * @param businessId - Business tenant ID (UUID)
   * @param customerId - Business customer profile ID (UUID)
   * @returns Customer entity if found and matches businessId; otherwise `null`
   */
  getCustomerById(businessId: string, customerId: string): Promise<BusinessCustomerEntity | null>;

  /**
   * Finds an existing customer profile matching either phone number or email.
   * Used during walk-in or public marketplace booking to prevent duplicate profiles.
   *
   * @param businessId - Business tenant ID (UUID)
   * @param criteria - Lookup criteria with phoneNumber or email
   * @returns Customer entity if found; otherwise `null`
   */
  findCustomerByPhoneOrEmail(
    businessId: string,
    criteria: { phoneNumber?: string; email?: string },
  ): Promise<BusinessCustomerEntity | null>;
}

/**
 * Pure read-only query service implementation.
 * All write or profile-creation operations are intentionally decoupled into dedicated use cases.
 */
export class CustomerQueryService implements ICustomerQueryService {
  constructor(private readonly customerRepository: ICustomerRepository) {}

  async isCustomerInBusiness(businessId: string, customerId: string): Promise<boolean> {
    const customer = await this.customerRepository.findById(businessId, customerId);
    return customer !== null && customer.status === 'active';
  }

  async getCustomerById(
    businessId: string,
    customerId: string,
  ): Promise<BusinessCustomerEntity | null> {
    return this.customerRepository.findById(businessId, customerId);
  }

  async findCustomerByPhoneOrEmail(
    businessId: string,
    criteria: { phoneNumber?: string; email?: string },
  ): Promise<BusinessCustomerEntity | null> {
    return this.customerRepository.findByPhoneOrEmail(businessId, criteria);
  }
}
