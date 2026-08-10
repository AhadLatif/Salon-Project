import type { TokenPayload } from '@salon/identity';
import { UnauthorizedError, ValidationError } from '@salon/shared';
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

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = createBusinessSchema.safeParse(req.body);

      if (!parseResult.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parseResult.error.issues) {
          const fieldName = issue.path.join('.');
          if (fieldName) {
            fieldErrors[fieldName] = issue.message;
          }
        }

        throw new ValidationError('Invalid business data', fieldErrors);
      }

      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const result = await this.createBusinessUseCase.execute({
        ownerUserId: req.user.userId,
        business: {
          name: parseResult.data.name,
          slug: parseResult.data.slug,
          email: parseResult.data.email,
          phoneNumber: parseResult.data.phoneNumber,
          description: parseResult.data.description ?? null,
          socialLinks: parseResult.data.socialLinks ?? null,
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

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      const businessId = Array.isArray(idParam) ? idParam[0] : idParam;
      if (!businessId) {
        throw new ValidationError('Missing business ID parameter', {
          id: 'Business ID is required',
        });
      }

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

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      const businessId = Array.isArray(idParam) ? idParam[0] : idParam;
      if (!businessId) {
        throw new ValidationError('Missing business ID parameter', {
          id: 'Business ID is required',
        });
      }

      const parseResult = updateBusinessSchema.safeParse(req.body);

      if (!parseResult.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parseResult.error.issues) {
          const fieldName = issue.path.join('.');
          if (fieldName) {
            fieldErrors[fieldName] = issue.message;
          }
        }

        throw new ValidationError('Invalid update business data', fieldErrors);
      }

      const updatedBusiness = await this.updateBusinessUseCase.execute(
        businessId,
        parseResult.data,
      );

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
