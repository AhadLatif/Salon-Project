import { getUuidParam, validateBody } from '@salon/shared';
import type { NextFunction, Request, Response } from 'express';
import type { AddFavoriteUseCase } from '../../application/use-cases/add-favorite.use-case.js';
import type { GetUserFavoritesUseCase } from '../../application/use-cases/get-user-favorites.use-case.js';
import type { RemoveFavoriteUseCase } from '../../application/use-cases/remove-favorite.use-case.js';
import { addFavoriteSchema } from '../dtos/add-favorite.schema.js';

// Augment Express Request: the identity module's `authMiddleware` attaches
// `req.user` (TokenPayload). Since each module compiles independently without
// a runtime dependency on @salon/identity, we re-declare the shape here to
// match the convention used by staff, business, and rbac controllers.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

export class CustomerFavoriteController {
  constructor(
    private readonly addFavoriteUseCase: AddFavoriteUseCase,
    private readonly removeFavoriteUseCase: RemoveFavoriteUseCase,
    private readonly getUserFavoritesUseCase: GetUserFavoritesUseCase,
  ) {}

  /**
   * Adds a salon business or staff member to the authenticated user's favorites list.
   *
   * @http POST /api/v1/favorites
   * @headers
   *   - Authorization: Bearer <accessToken>
   * @body
   *   - businessId?: string (UUID, polymorphic target)
   *   - staffMemberId?: string (UUID, polymorphic target)
   *   (Invariant: At least one of businessId or staffMemberId must be provided)
   *
   * @flow
   *   Client -> authMiddleware -> CustomerFavoriteController.create
   *          -> validateBody(addFavoriteSchema)
   *          -> AddFavoriteUseCase.execute
   *          -> CustomerFavoriteRepository.addFavorite (upsert / onConflictDoNothing)
   *
   * @returns 201 Created { success: true, data: { favorite: { id, userId, businessId, staffMemberId, ... } }, meta: {} }
   * @throws 400 Bad Request (Neither businessId nor staffMemberId supplied)
   * @throws 401 Unauthorized (Missing or invalid access token)
   * @throws 409 Conflict (Already favorited)
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user?.userId) {
        throw new Error('authMiddleware did not populate req.user on the favorites router');
      }

      const data = validateBody(addFavoriteSchema, req.body, 'Invalid favorite payload');

      const favorite = await this.addFavoriteUseCase.execute({
        ...data,
        userId: user.userId,
      });

      res.status(201).json({
        success: true,
        data: { favorite },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves all saved favorites for the authenticated user with joined salon/staff details.
   *
   * @http GET /api/v1/favorites
   * @headers
   *   - Authorization: Bearer <accessToken>
   *
   * @flow
   *   Client -> authMiddleware -> CustomerFavoriteController.findAll
   *          -> GetUserFavoritesUseCase.execute(userId)
   *          -> CustomerFavoriteRepository.findByUserId
   *
   * @returns 200 OK { success: true, data: { favorites: [ ... ] }, meta: {} }
   * @throws 401 Unauthorized
   */
  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user?.userId) {
        throw new Error('authMiddleware did not populate req.user on the favorites router');
      }

      const favorites = await this.getUserFavoritesUseCase.execute(user.userId);

      res.status(200).json({
        success: true,
        data: { favorites },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Removes a saved favorite for the authenticated user.
   *
   * @http DELETE /api/v1/favorites/:favoriteId
   * @headers
   *   - Authorization: Bearer <accessToken>
   * @params
   *   - :favoriteId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> CustomerFavoriteController.delete
   *          -> RemoveFavoriteUseCase.execute(favoriteId, userId)
   *          -> CustomerFavoriteRepository.delete
   *
   * @returns 200 OK { success: true, data: { deleted: true }, meta: {} }
   * @throws 401 Unauthorized
   * @throws 404 Not Found (Favorite not found or belongs to another user)
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user?.userId) {
        throw new Error('authMiddleware did not populate req.user on the favorites router');
      }

      const favoriteId = getUuidParam(req, 'favoriteId');

      await this.removeFavoriteUseCase.execute(favoriteId, user.userId);

      res.status(200).json({
        success: true,
        data: { deleted: true },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }
}
