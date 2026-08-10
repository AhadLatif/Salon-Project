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
      };
    }
  }
}

/**
 * Middleware factory to enforce granular RBAC permissions.
 *
 * Preconditions:
 * 1. `authMiddleware` must run before to populate `req.user`.
 * 2. `tenantMiddleware` must run before to populate `req.tenant`.
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
