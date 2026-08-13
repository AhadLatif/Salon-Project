import { ResourceNotFoundError } from '@salon/shared';
import type { ServiceCategoryEntity } from '../../domain/entities/service-category.entity.js';
import type {
  IServiceCategoryRepository,
  UpdateServiceCategoryData,
} from '../ports/service-category-repository.port.js';

export class UpdateCategoryUseCase {
  constructor(private readonly categoryRepository: IServiceCategoryRepository) {}

  async execute(
    businessId: string,
    categoryId: string,
    data: UpdateServiceCategoryData,
  ): Promise<ServiceCategoryEntity> {
    const category = await this.categoryRepository.update(businessId, categoryId, data);

    if (!category) {
      throw new ResourceNotFoundError('Service category not found');
    }

    return category;
  }
}
