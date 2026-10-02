import type { BusinessEntity } from '../../domain/entities/business.entity.js';

/**
 * Shapes a business for an HTTP response.
 *
 * WHY THIS EXISTS: this is the ONLY place that decides which fields may leave the module. It
 * replaces `BusinessEntity.toPrimitives()`, which spread whatever happened to be on the object —
 * that is precisely how `ownerUserId` (neither a column nor a field in `business.openapi.ts`) ended
 * up in public responses. An explicit allow-list makes an undeclared field impossible to publish by
 * accident, and the list below mirrors `api/docs/business.openapi.ts` field for field.
 *
 * INVARIANT: adding a column to the `businesses` table does NOT publish it. Decide here, and keep
 * the OpenAPI registry in step.
 */
export interface BusinessResponse {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  email: string;
  phoneNumber: string;
  status: string;
  isPublished: boolean;
  socialLinks: Record<string, string> | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toBusinessResponse(business: BusinessEntity): BusinessResponse {
  return {
    id: business.id,
    slug: business.slug,
    name: business.name,
    description: business.description,
    email: business.email,
    phoneNumber: business.phoneNumber,
    status: business.status,
    isPublished: business.isPublished,
    socialLinks: business.socialLinks,
    verifiedAt: business.verifiedAt,
    createdAt: business.createdAt,
    updatedAt: business.updatedAt,
  };
}
