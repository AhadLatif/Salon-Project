import { ForbiddenError, UnauthorizedError, ValidationError } from '@salon/shared';
import { z } from '@salon/validation';
import type { NextFunction, Request, Response } from 'express';
import type { IBranchValidator } from '../../application/ports/branch-validator.port.js';
import type { IRbacRepository } from '../../application/ports/rbac-repository.port.js';
import type { IStaffBranchAccessValidator } from '../../application/ports/staff-branch-access-validator.port.js';

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
 * BRANCH-LEVEL DATA ISOLATION & ACCESS CONTROL MIDDLEWARE FACTORY
 *
 * Enforces that the caller has access to the specific physical branch requested via `x-branch-id`.
 * System Owners have implicit access to all branches within their business.
 * Non-owner staff members must have an active assignment to the target branch.
 *
 * @input
 *   - req.user: TokenPayload
 *   - req.tenant: TenantContext
 *   - req.headers['x-branch-id']: string (UUID)
 *
 * @mutates
 *   - req.tenant.branchId: string (sets validated branch UUID)
 *
 * @exits
 *   - Calls `next()` if branch access is verified.
 *   - Passes `UnauthorizedError` (401) to `next(error)` if user is unauthenticated.
 *   - Passes `ValidationError` (400) to `next(error)` if `x-branch-id` is missing or not a UUID.
 *   - Passes `ForbiddenError` (403) to `next(error)` if branch does not belong to business or staff lacks assignment.
 */
export function createRequireBranchContextMiddleware(
  rbacRepository: IRbacRepository,
  branchValidator: IBranchValidator,
  staffBranchValidator: IStaffBranchAccessValidator,
) {
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

      // 1. Check if user holds the system 'Owner' role
      const isOwner = await rbacRepository.isOwner(req.tenant.roleId, req.tenant.businessId);

      let hasAccess = false;
      if (isOwner) {
        // System Owners have implicit access to any non-archived branch belonging to the business
        hasAccess = await branchValidator.isBranchInBusiness(req.tenant.businessId, branchId);
      } else {
        // Non-owners must have an active staff profile assigned to the branch
        hasAccess = await staffBranchValidator.hasStaffBranchAssignment(
          req.tenant.businessId,
          req.tenant.memberId,
          branchId,
        );
      }

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
