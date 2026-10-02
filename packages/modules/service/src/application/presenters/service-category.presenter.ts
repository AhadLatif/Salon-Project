import type { ServiceCategoryEntity } from '../../domain/entities/service-category.entity.js';

/**
 * Shapes a service category for an HTTP response.
 *
 * WHY THIS EXISTS: replaces `ServiceCategoryEntity.toPrimitives()`, the only place that previously
 * decided what a category endpoint exposed. It is now an explicit allow-list.
 *
 * ⚠️ TIMESTAMPS STAY `Date` OBJECTS, exactly as the former `toPrimitives()` returned them — changing
 * that would silently change the JSON contract for every category endpoint.
 */
export interface ServiceCategoryResponse {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toServiceCategoryResponse(
  category: ServiceCategoryEntity,
): ServiceCategoryResponse {
  return {
    id: category.id,
    businessId: category.businessId,
    name: category.name,
    description: category.description,
    displayOrder: category.displayOrder,
    isActive: category.isActive,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}
