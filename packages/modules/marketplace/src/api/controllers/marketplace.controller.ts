import { respondOk, validateQuery } from '@salon/shared';
import type { NextFunction, Request, Response } from 'express';
import type {
  GetBusinessListUseCase,
  GetBusinessProfileUseCase,
} from '../../application/use-cases/index.js';
import { businessListQuerySchema } from '../dtos/public-business.schema.js';

export class MarketplaceController {
  constructor(
    private readonly getBusinessProfileUseCase: GetBusinessProfileUseCase,
    private readonly getBusinessListUseCase: GetBusinessListUseCase,
  ) {}
  public ping(req: Request, res: Response): void {
    // respondOk guarantees the `{ success, data, error, meta }` envelope. Hand-writing
    // `res.json({...})` here is exactly the drift that BUG-06 caught in the identity module.
    respondOk(
      res,
      200,
      req.user
        ? { message: 'Pong! Welcome back logged-in user', userId: req.user.userId }
        : { message: 'Pong! Welcome anonymous guest' },
    );
  }

  public async getBusinessBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = req.params.slug as string;
      const profile = await this.getBusinessProfileUseCase.execute(slug);

      respondOk(res, 200, profile);
    } catch (error) {
      next(error);
    }
  }

  public async listBusinesses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = validateQuery(businessListQuerySchema, req.query);
      const result = await this.getBusinessListUseCase.execute(query.limit, query.offset);

      respondOk(res, 200, result.items, {
        total: result.total,
        limit: query.limit,
        offset: query.offset,
      });
    } catch (error) {
      next(error);
    }
  }
}
