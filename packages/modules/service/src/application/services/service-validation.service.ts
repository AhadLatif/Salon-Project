import type { IServiceRepository } from '../ports/service-repository.port.js';

export interface IServiceValidationService {
  isServiceInBusiness(businessId: string, serviceId: string): Promise<boolean>;
}

/**
 * Service providing cross-module service catalog validation.
 * Encapsulates service existence, active status, and tenant isolation rules.
 */
export class ServiceValidationService implements IServiceValidationService {
  constructor(private readonly serviceRepository: IServiceRepository) {}

  /**
   * Verifies that a service exists, belongs to the specified business tenant, and is active.
   */
  async isServiceInBusiness(businessId: string, serviceId: string): Promise<boolean> {
    return await this.serviceRepository.isServiceInBusiness(businessId, serviceId);
  }
}
