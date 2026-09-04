import type { IServiceRepository } from '../ports/service-repository.port.js';

export interface ServiceSnapshot {
  id: string;
  name: string;
  defaultPrice: string;
  defaultDurationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  isActive: boolean;
}

export interface IServiceValidationService {
  isServiceInBusiness(businessId: string, serviceId: string): Promise<boolean>;
  isServiceBookableAtBranch(
    businessId: string,
    serviceId: string,
    branchId: string,
  ): Promise<boolean>;
  getServiceSnapshots(businessId: string, serviceIds: string[]): Promise<ServiceSnapshot[]>;
  getServiceDetails(businessId: string, serviceId: string): Promise<ServiceSnapshot | null>;
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

  /**
   * Verifies that a service is assigned to a branch and marked bookable.
   */
  async isServiceBookableAtBranch(
    businessId: string,
    serviceId: string,
    branchId: string,
  ): Promise<boolean> {
    return await this.serviceRepository.isServiceBookableAtBranch(businessId, serviceId, branchId);
  }

  /**
   * Retrieves snapshots for multiple services belonging to a business.
   */
  async getServiceSnapshots(businessId: string, serviceIds: string[]): Promise<ServiceSnapshot[]> {
    const services = await this.serviceRepository.findByIds(businessId, serviceIds);
    return services.map((s) => ({
      id: s.id as string,
      name: s.name,
      defaultPrice: s.defaultPrice,
      defaultDurationMinutes: s.defaultDurationMinutes,
      bufferBeforeMinutes: s.bufferBeforeMinutes,
      bufferAfterMinutes: s.bufferAfterMinutes,
      isActive: s.isActive,
    }));
  }

  /**
   * Retrieves detail snapshot for a single service.
   */
  async getServiceDetails(businessId: string, serviceId: string): Promise<ServiceSnapshot | null> {
    const service = await this.serviceRepository.findById(businessId, serviceId);
    if (!service) return null;
    return {
      id: service.id as string,
      name: service.name,
      defaultPrice: service.defaultPrice,
      defaultDurationMinutes: service.defaultDurationMinutes,
      bufferBeforeMinutes: service.bufferBeforeMinutes,
      bufferAfterMinutes: service.bufferAfterMinutes,
      isActive: service.isActive,
    };
  }
}
