import { ResourceNotFoundError } from '@salon/shared';
import type { IServiceCategoryRepository } from '../ports/service-category-repository.port.js';

export class DeactivateCategoryUseCase {
  constructor(private readonly categoryRepository: IServiceCategoryRepository) {}

  async execute(businessId: string, categoryId: string): Promise<void> {
    const deactivated = await this.categoryRepository.deactivate(businessId, categoryId);

    if (!deactivated) {
      throw new ResourceNotFoundError('Service category not found');
    }
  }
}
