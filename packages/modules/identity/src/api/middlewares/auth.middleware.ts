import { UnauthorizedError } from '@salon/shared';
import type { NextFunction, Request, Response } from 'express';
import type { ITokenService, TokenPayload } from '../../application/ports/token-service.port.js';

// Augment Express Request to include the authenticated user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Express middleware that authenticates a request by verifying the
 * `Authorization: Bearer <token>` header.
 *
 * On success, attaches `req.user = { userId, email }` and calls `next()`.
 * On failure (missing/invalid/expired token), throws `UnauthorizedError`.
 */
export function createAuthMiddleware(tokenService: ITokenService) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      next(new UnauthorizedError('Missing or malformed Authorization header'));
      return;
    }

    const token = authHeader.slice('Bearer '.length).trim();

    if (!token) {
      next(new UnauthorizedError('Missing access token'));
      return;
    }

    try {
      const payload = tokenService.verifyToken(token);
      req.user = payload;
      next();
    } catch (error) {
      // verifyToken already throws UnauthorizedError; pass it through.
      next(error);
    }
  };
}
