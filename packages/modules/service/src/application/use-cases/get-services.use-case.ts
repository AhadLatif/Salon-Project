import type { ServiceEntity } from '../../domain/entities/service.entity.js';
import type { IServiceRepository } from '../ports/service-repository.port.js';

export class GetServicesUseCase {
  constructor(private readonly serviceRepository: IServiceRepository) {}

  async execute(
    businessId: string,
    options?: { categoryId?: string; includeInactive?: boolean },
  ): Promise<ServiceEntity[]> {
    return await this.serviceRepository.findAllByBusinessId(businessId, options);
  }
}
