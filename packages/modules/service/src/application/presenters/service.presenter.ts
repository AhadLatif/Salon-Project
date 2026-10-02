import type { ServiceEntity } from '../../domain/entities/service.entity.js';

/**
 * Shapes a service offering for an HTTP response.
 *
 * WHY THIS EXISTS: replaces `ServiceEntity.toPrimitives()`. Keeping the allow-list here — rather
 * than spreading whatever is on the object — means a new `services` column cannot leak to clients
 * without someone deliberately adding it, and the list stays reviewable next to the OpenAPI registry.
 *
 * ⚠️ TIMESTAMPS STAY `Date` OBJECTS. The former `toPrimitives()` returned `createdAt`/`updatedAt`
 * directly (Express serializes them to ISO strings). Returning a different type here would change
 * the JSON contract for every service endpoint, so the previous output shape is preserved exactly.
 */
export interface ServiceResponse {
  id: string;
  businessId: string;
  categoryId: string;
  name: string;
  description: string | null;
  defaultPrice: string;
  defaultDurationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  color: string | null;
  isBookable: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toServiceResponse(service: ServiceEntity): ServiceResponse {
  return {
    id: service.id,
    businessId: service.businessId,
    categoryId: service.categoryId,
    name: service.name,
    description: service.description,
    defaultPrice: service.defaultPrice,
    defaultDurationMinutes: service.defaultDurationMinutes,
    bufferBeforeMinutes: service.bufferBeforeMinutes,
    bufferAfterMinutes: service.bufferAfterMinutes,
    color: service.color,
    isBookable: service.isBookable,
    isActive: service.isActive,
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
  };
}
