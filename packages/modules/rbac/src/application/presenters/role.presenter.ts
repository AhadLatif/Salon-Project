import type { RoleEntity } from '../../domain/entities/role.entity.js';

/**
 * Shapes a role for an HTTP response.
 *
 * WHY THIS EXISTS: replaces `RoleEntity.toPrimitives()`, the only place that previously decided what
 * a role endpoint exposed. Keeping that decision here — next to the OpenAPI registry — makes it an
 * explicit allow-list instead of "whatever happened to be on the object".
 *
 * ⚠️ TIMESTAMPS ARE ISO STRINGS, NOT Date OBJECTS. The former `toPrimitives()` emitted
 * `createdAt.toISOString()`. Returning `Date` here would let Express serialize them differently and
 * silently change the JSON contract for every role endpoint, so this deliberately preserves the
 * exact previous output.
 */
export interface RoleResponse {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  displayOrder: number;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export function toRoleResponse(role: RoleEntity): RoleResponse {
  return {
    id: role.id,
    businessId: role.businessId,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    displayOrder: role.displayOrder,
    permissions: role.permissions,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}
