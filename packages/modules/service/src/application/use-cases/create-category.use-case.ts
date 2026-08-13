import type { ServiceCategoryEntity } from '../../domain/entities/service-category.entity.js';
import type {
  CreateServiceCategoryData,
  IServiceCategoryRepository,
} from '../ports/service-category-repository.port.js';

export class CreateCategoryUseCase {
  constructor(private readonly categoryRepository: IServiceCategoryRepository) {}

  async execute(data: CreateServiceCategoryData): Promise<ServiceCategoryEntity> {
    return await this.categoryRepository.create(data);
  }
}
