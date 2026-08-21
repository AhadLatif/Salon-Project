import { ForbiddenError } from '../errors/base.error.js';

export interface TenantContext {
  businessId: string;
  memberId: string;
  roleId: string;
  branchId?: string;
}

export interface TenantRequestLike {
  tenant?: TenantContext;
  params?: Record<string, string | string[] | undefined>;
}

/**
 * SECURITY: IDOR Protection & Multi-Tenant Boundary
 *
 * The `tenantMiddleware` (in @salon/business) is the SINGLE source of truth for tenant
 * verification: it reads the `x-business-id` header, validates it's a UUID, and verifies
 * the authenticated user has an active membership in that business against the DB.
 *
 * This helper does NOT re-verify the tenant (that would be redundant). It only:
 * 1. Asserts the middleware chain actually ran (throws 500 if `req.tenant` is missing,
 *    which signals a middleware misconfiguration — an internal invariant failure).
 * 2. Cross-checks that any `:businessId` route param strictly matches the verified
 *    `req.tenant.businessId`. This closes the IDOR gap where a URL param could otherwise
 *    reference a DIFFERENT tenant than the one the user is authorized for.
 *
 * Throws:
 * - `Error` (500) if the tenant context is missing (middleware chain misconfiguration).
 * - `ForbiddenError` (403) if a `:businessId` path param mismatches the verified tenant.
 */
export function getTenantContext(req: TenantRequestLike): TenantContext {
  const tenant = req.tenant;
  if (!tenant?.businessId) {
    // Internal invariant failure: the tenant middleware must run before any controller
    // that needs tenant context. This is a 500, NOT a client-facing 4xx.
    throw new Error('Tenant context missing after tenant middleware.');
  }

  const businessIdFromPath = req.params?.businessId;
  const pathId = Array.isArray(businessIdFromPath) ? businessIdFromPath[0] : businessIdFromPath;

  if (pathId && pathId !== tenant.businessId) {
    throw new ForbiddenError('Tenant context does not match the requested resource path.');
  }

  return tenant;
}
