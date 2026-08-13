import { ConflictError, ForbiddenError } from '@salon/shared';
import type { ServiceEntity } from '../../domain/entities/service.entity.js';
import type { IServiceCategoryRepository } from '../ports/service-category-repository.port.js';
import type { CreateServiceData, IServiceRepository } from '../ports/service-repository.port.js';

export class CreateServiceUseCase {
  constructor(
    private readonly serviceRepository: IServiceRepository,
    private readonly categoryRepository: IServiceCategoryRepository,
  ) {}

  async execute(data: CreateServiceData): Promise<ServiceEntity> {
    const category = await this.categoryRepository.findById(data.businessId, data.categoryId, {
      includeInactive: true,
    });

    if (!category) {
      throw new ForbiddenError('Invalid category ID or category does not belong to this business');
    }

    if (!category.isActive) {
      throw new ConflictError('Cannot create service in an inactive category');
    }

    return await this.serviceRepository.create(data);
  }
}
