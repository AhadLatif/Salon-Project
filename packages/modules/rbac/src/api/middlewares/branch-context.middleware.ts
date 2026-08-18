import { ForbiddenError, UnauthorizedError, ValidationError } from '@salon/shared';
import { z } from '@salon/validation';
import type { NextFunction, Request, Response } from 'express';
import type { IRbacRepository } from '../../application/ports/rbac-repository.port.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant?: {
        businessId: string;
        memberId: string;
        roleId: string;
        branchId?: string;
      };
    }
  }
}

/**
 * Middleware factory to enforce branch-level data isolation.
 *
 * Preconditions:
 * 1. `authMiddleware` must run before to populate `req.user`.
 * 2. `tenantMiddleware` must run before to populate `req.tenant`.
 */
export function createRequireBranchContextMiddleware(rbacRepository: IRbacRepository) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required to check branch access.');
      }

      if (!req.tenant) {
        throw new Error('Tenant context missing.');
      }

      const rawBranchId = req.headers['x-branch-id'];

      if (!rawBranchId || typeof rawBranchId !== 'string') {
        throw new ValidationError('Missing or invalid x-branch-id header.', {
          'x-branch-id': 'This header is required for branch-scoped requests.',
        });
      }

      const parseResult = z.string().uuid().safeParse(rawBranchId);
      if (!parseResult.success) {
        throw new ValidationError('x-branch-id header must be a valid UUID.', {
          'x-branch-id': 'Must be a valid UUID.',
        });
      }

      const branchId = parseResult.data;

      // Verify branch access
      const hasAccess = await rbacRepository.hasBranchAccess(
        req.tenant.roleId,
        req.tenant.businessId,
        req.tenant.memberId,
        branchId,
      );

      if (!hasAccess) {
        throw new ForbiddenError(
          'Access denied: You are not authorized to perform actions in this branch.',
        );
      }

      // Inject branchId into tenant context
      req.tenant.branchId = branchId;

      next();
    } catch (error) {
      next(error);
    }
  };
}
