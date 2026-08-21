import { ForbiddenError, UnauthorizedError } from '@salon/shared';
import type { NextFunction, Request, Response } from 'express';
import type { IRbacRepository } from '../../application/ports/rbac-repository.port.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
      };
      tenant?: {
        memberId: string;
        roleId: string;
        businessId: string;
        branchId?: string; // Populated by branchContextMiddleware
      };
    }
  }
}

/**
 * GRANULAR RBAC PERMISSION ENFORCEMENT MIDDLEWARE FACTORY
 *
 * Checks whether the caller's tenant role possesses the required permission code
 * (or bypasses checks if the role is the System Owner).
 *
 * @input
 *   - req.user: TokenPayload (populated by upstream authMiddleware)
 *   - req.tenant: TenantContext (populated by upstream tenantMiddleware)
 *   - permissionCode: string (e.g. 'staff.manage', 'service.create')
 *
 * @exits
 *   - Calls `next()` if the user's role has the required permission or is System Owner.
 *   - Passes `UnauthorizedError` (401) to `next(error)` if `req.user` is missing.
 *   - Passes `ForbiddenError` (403) to `next(error)` if `req.tenant` is missing or permission is denied.
 */
export function createRequirePermissionMiddleware(rbacRepository: IRbacRepository) {
  return (permissionCode: string) => {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          throw new UnauthorizedError('Authentication required to check permissions.');
        }

        if (!req.tenant) {
          throw new ForbiddenError(
            'Tenant context missing. Ensure tenantMiddleware is mounted before permission checks.',
          );
        }

        const isAllowed = await rbacRepository.hasPermission(
          req.tenant.roleId,
          req.tenant.businessId,
          permissionCode,
        );

        if (!isAllowed) {
          throw new ForbiddenError(
            `Access denied: Missing required permission '${permissionCode}'.`,
          );
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  };
}
