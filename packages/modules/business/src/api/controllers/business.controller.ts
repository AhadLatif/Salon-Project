import type { TokenPayload } from '@salon/identity';
import { getTenantContext, UnauthorizedError, validateBody } from '@salon/shared';
import type { NextFunction, Request, Response } from 'express';
import type { CreateBusinessUseCase } from '../../application/use-cases/create-business.use-case.js';
import type { GetBusinessByIdUseCase } from '../../application/use-cases/get-business-by-id.use-case.js';
import type { GetMyBusinessesUseCase } from '../../application/use-cases/get-my-businesses.use-case.js';
import type { UpdateBusinessUseCase } from '../../application/use-cases/update-business.use-case.js';
import { createBusinessSchema } from '../dtos/create-business.schema.js';
import { updateBusinessSchema } from '../dtos/update-business.schema.js';

// Augment Express Request to include the authenticated user from the identity module's auth middleware.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export class BusinessController {
  constructor(
    private readonly createBusinessUseCase: CreateBusinessUseCase,
    private readonly getMyBusinessesUseCase: GetMyBusinessesUseCase,
    private readonly getBusinessByIdUseCase: GetBusinessByIdUseCase,
    private readonly updateBusinessUseCase: UpdateBusinessUseCase,
  ) {}

  /**
   * Bootstraps a new business tenant, creates the business member record,
   * and assigns the creator the default System Owner role.
   *
   * @http POST /api/v1/businesses
   * @headers
   *   - Authorization: Bearer <accessToken>
   * @body
   *   - name: string (1-200 chars)
   *   - slug: string (lowercase alphanumeric with hyphens)
   *   - email: string (valid email)
   *   - phoneNumber: string (E.164 format e.g. +1234567890)
   *   - description?: string
   *   - socialLinks?: Record<string, string>
   *
   * @flow
   *   Client -> authMiddleware (verifies user JWT)
   *          -> BusinessController.create
   *          -> validateBody(createBusinessSchema)
   *          -> CreateBusinessUseCase.execute
   *          -> BusinessRepository.create (transaction: business + business_member + owner_role)
   *
   * @returns 201 Created { success: true, data: { business: { id, name, slug, ... } }, meta: {} }
   * @throws 400 Bad Request (Validation failed)
   * @throws 401 Unauthorized (Missing auth token)
   * @throws 409 Conflict (Business slug already in use)
   */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = validateBody(createBusinessSchema, req.body, 'Invalid business data');

      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const result = await this.createBusinessUseCase.execute({
        ownerUserId: req.user.userId,
        business: {
          name: data.name,
          slug: data.slug,
          email: data.email,
          phoneNumber: data.phoneNumber,
          description: data.description ?? null,
          socialLinks: data.socialLinks ?? null,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          business: result.toPrimitives(),
        },
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Returns all business tenants where the authenticated user is a member.
   *
   * @http GET /api/v1/businesses/me
   * @headers
   *   - Authorization: Bearer <accessToken>
   *
   * @flow
   *   Client -> authMiddleware
   *          -> BusinessController.getMyBusinesses
   *          -> GetMyBusinessesUseCase.execute(userId)
   *          -> BusinessRepository.findAllByUserId
   *
   * @returns 200 OK { success: true, data: { businesses: [ ... ] }, meta: { total: number } }
   * @throws 401 Unauthorized (Missing auth token)
   */
  getMyBusinesses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const businesses = await this.getMyBusinessesUseCase.execute(req.user.userId);

      res.status(200).json({
        success: true,
        data: {
          businesses: businesses.map((b) => b.toPrimitives()),
        },
        meta: {
          total: businesses.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Returns business tenant profile details.
   *
   * @http GET /api/v1/businesses/:businessId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID, verified against x-business-id to prevent IDOR)
   *
   * @flow
   *   Client -> authMiddleware
   *          -> tenantMiddleware (verifies membership in x-business-id)
   *          -> BusinessController.getById
   *          -> getTenantContext(req) (IDOR assertion)
   *          -> GetBusinessByIdUseCase.execute(businessId)
   *          -> BusinessRepository.findById
   *
   * @returns 200 OK { success: true, data: { business: { id, name, slug, ... } }, meta: {} }
   * @throws 401 Unauthorized (Missing auth token)
   * @throws 403 Forbidden (Cross-tenant IDOR / no membership in this business)
   * @throws 404 Not Found (Business does not exist)
   */
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = getTenantContext(req);

      const business = await this.getBusinessByIdUseCase.execute(businessId);

      res.status(200).json({
        success: true,
        data: {
          business: business.toPrimitives(),
        },
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Updates business tenant profile settings.
   *
   * @http PATCH /api/v1/businesses/:businessId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID, verified against x-business-id)
   * @body
   *   - name?: string
   *   - email?: string
   *   - phoneNumber?: string
   *   - description?: string
   *   - socialLinks?: Record<string, string>
   *
   * @flow
   *   Client -> authMiddleware
   *          -> tenantMiddleware
   *          -> BusinessController.update
   *          -> getTenantContext(req) (IDOR assertion)
   *          -> validateBody(updateBusinessSchema)
   *          -> UpdateBusinessUseCase.execute(businessId, data)
   *          -> BusinessRepository.update
   *
   * @returns 200 OK { success: true, data: { business: { ... } }, meta: {} }
   * @throws 400 Bad Request (Validation failed)
   * @throws 403 Forbidden (Cross-tenant IDOR / no membership)
   * @throws 404 Not Found (Business not found)
   */
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = getTenantContext(req);
      const data = validateBody(updateBusinessSchema, req.body, 'Invalid update business data');

      const updatedBusiness = await this.updateBusinessUseCase.execute(businessId, data);

      res.status(200).json({
        success: true,
        data: {
          business: updatedBusiness.toPrimitives(),
        },
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  };
}
