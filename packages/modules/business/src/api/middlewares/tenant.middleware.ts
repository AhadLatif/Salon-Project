import { ForbiddenError, UnauthorizedError, ValidationError } from '@salon/shared';
import { z } from '@salon/validation';
import type { NextFunction, Request, Response } from 'express';
import type { IBusinessRepository } from '../../application/ports/business-repository.port.js';

// Extend Express Request to include tenant context
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
 * TENANT ISOLATION & MEMBERSHIP VERIFICATION MIDDLEWARE FACTORY
 *
 * Intercepts incoming requests, extracts `x-business-id` header, verifies that the
 * authenticated user (`req.user`) has an active membership in that business, and attaches `req.tenant`.
 *
 * @input
 *   - req.user: TokenPayload (populated by upstream authMiddleware)
 *   - req.headers['x-business-id']: string (UUID)
 *
 * @mutates
 *   - req.tenant: { businessId: string, memberId: string, roleId: string, branchId?: string }
 *
 * @exits
 *   - Calls `next()` if membership is verified in the database.
 *   - Passes `UnauthorizedError` (401) to `next(error)` if `req.user` is missing.
 *   - Passes `ValidationError` (400) to `next(error)` if `x-business-id` is missing or not a valid UUID.
 *   - Passes `ForbiddenError` (403) to `next(error)` if user is not a member of this business.
 */
export function createTenantMiddleware(businessRepository: IBusinessRepository) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Defensive guard: Verifies that authMiddleware ran earlier in the pipeline and populated req.user
      if (!req.user) {
        throw new UnauthorizedError('Authentication required to access tenant resources.');
      }

      // 2. Extract and validate x-business-id header
      const rawBusinessId = req.headers['x-business-id'];

      if (!rawBusinessId || typeof rawBusinessId !== 'string') {
        throw new ValidationError('Missing or invalid x-business-id header.', {
          'x-business-id': 'This header is required for tenant-scoped requests.',
        });
      }

      const uuidSchema = z.string().uuid();
      const parseResult = uuidSchema.safeParse(rawBusinessId);

      if (!parseResult.success) {
        throw new ValidationError('Invalid x-business-id format.', {
          'x-business-id': 'Must be a valid UUID.',
        });
      }

      const businessId = parseResult.data;

      // 3. Verify membership against the database
      const membership = await businessRepository.getMembership(req.user.userId, businessId);

      if (!membership) {
        // We throw ForbiddenError instead of NotFound to obscure whether the business ID is real
        // if the user doesn't belong to it (security best practice).
        throw new ForbiddenError('Access denied: You do not have access to this business.');
      }

      // 4. Attach verified tenant context to the request
      req.tenant = {
        businessId,
        memberId: membership.memberId,
        roleId: membership.roleId,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}
