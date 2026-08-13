import type { ServiceCategoryEntity } from '../../domain/entities/service-category.entity.js';
import type { IServiceCategoryRepository } from '../ports/service-category-repository.port.js';

export class GetCategoriesUseCase {
  constructor(private readonly categoryRepository: IServiceCategoryRepository) {}

  async execute(
    businessId: string,
    options?: { includeInactive?: boolean },
  ): Promise<ServiceCategoryEntity[]> {
    return await this.categoryRepository.findAllByBusinessId(businessId, options);
  }
}
