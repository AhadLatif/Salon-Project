/**
 * A business role (system or custom) together with the permission codes granted to it.
 *
 * CONTRACT — maps 1:1 onto a `business_roles` row plus `permissions`, which the repository
 * assembles from `business_role_permissions` joined to `permissions`. It is a persisted shape.
 *
 * WHY AN INTERFACE RATHER THAN A CLASS: the previous class held `props` behind a `toPrimitives()`
 * escape hatch and carried no behaviour beyond copying fields (and applying `?? null`, `?? 0`,
 * `?? []`, `?? new Date()` defaults). TypeScript's `private` is erased at runtime, so serializing
 * the instance without calling `toPrimitives()` would have emitted `{"props":{…}}` — a wrong payload
 * no type check can catch. Role is a bag of fields, so it is modelled as a shape; `toRoleResponse`
 * owns what leaves the module.
 *
 * DEFAULTS: the former constructor's fallbacks now apply at the single point where a role is built
 * (the repository mapper), so a role is never partially populated.
 */
export interface RoleEntity {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  displayOrder: number;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}
