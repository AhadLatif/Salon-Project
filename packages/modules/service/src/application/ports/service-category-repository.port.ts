import type { ServiceCategoryEntity } from '../../domain/entities/service-category.entity.js';

export interface CreateServiceCategoryData {
  businessId: string;
  name: string;
  description?: string | null | undefined;
  displayOrder?: number | undefined;
}

export interface UpdateServiceCategoryData {
  name?: string | undefined;
  description?: string | null | undefined;
  displayOrder?: number | undefined;
  isActive?: boolean | undefined;
}

export interface IServiceCategoryRepository {
  create(data: CreateServiceCategoryData): Promise<ServiceCategoryEntity>;

  findById(
    businessId: string,
    categoryId: string,
    options?: { includeInactive?: boolean },
  ): Promise<ServiceCategoryEntity | null>;

  findAllByBusinessId(
    businessId: string,
    options?: { includeInactive?: boolean },
  ): Promise<ServiceCategoryEntity[]>;

  update(
    businessId: string,
    categoryId: string,
    data: UpdateServiceCategoryData,
  ): Promise<ServiceCategoryEntity | null>;

  deactivate(businessId: string, categoryId: string): Promise<boolean>;
}
