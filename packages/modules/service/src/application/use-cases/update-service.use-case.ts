import { ConflictError, ForbiddenError, ResourceNotFoundError } from '@salon/shared';
import type { ServiceEntity } from '../../domain/entities/service.entity.js';
import type { IServiceCategoryRepository } from '../ports/service-category-repository.port.js';
import type { IServiceRepository, UpdateServiceData } from '../ports/service-repository.port.js';

export class UpdateServiceUseCase {
  constructor(
    private readonly serviceRepository: IServiceRepository,
    private readonly categoryRepository: IServiceCategoryRepository,
  ) {}

  async execute(
    businessId: string,
    serviceId: string,
    data: UpdateServiceData,
  ): Promise<ServiceEntity> {
    if (data.categoryId) {
      const category = await this.categoryRepository.findById(businessId, data.categoryId, {
        includeInactive: true,
      });

      if (!category) {
        throw new ForbiddenError(
          'Invalid category ID or category does not belong to this business',
        );
      }

      if (!category.isActive) {
        throw new ConflictError('Cannot move service to an inactive category');
      }
    }

    const service = await this.serviceRepository.update(businessId, serviceId, data);

    if (!service) {
      throw new ResourceNotFoundError('Service not found');
    }

    return service;
  }
}
