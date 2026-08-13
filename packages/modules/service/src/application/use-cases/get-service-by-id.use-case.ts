import { ResourceNotFoundError } from '@salon/shared';
import type { ServiceEntity } from '../../domain/entities/service.entity.js';
import type { IServiceRepository } from '../ports/service-repository.port.js';

export class GetServiceByIdUseCase {
  constructor(private readonly serviceRepository: IServiceRepository) {}

  async execute(businessId: string, serviceId: string): Promise<ServiceEntity> {
    const service = await this.serviceRepository.findById(businessId, serviceId, {
      includeInactive: false,
    });

    if (!service) {
      throw new ResourceNotFoundError('Service not found or is inactive');
    }

    return service;
  }
}
