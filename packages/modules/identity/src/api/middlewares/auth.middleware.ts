import type { NextFunction, Request, Response } from 'express';
import type { ITokenService, TokenPayload } from '../../application/ports/token-service.port.js';
import { resolveAuthenticatedUser } from '../controllers/bearer-token.extractor.js';

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
 * AUTHENTICATION MIDDLEWARE FACTORY
 *
 * Verifies JWT access token in the `Authorization: Bearer <token>` header,
 * extracts decoded payload claims, and attaches `req.user`.
 *
 * @input
 *   - req.headers.authorization: string ('Bearer <accessToken>')
 *
 * @mutates
 *   - req.user: TokenPayload ({ sub: userId, email, tokenVersion })
 *
 * @exits
 *   - Calls `next()` if access token is valid and unexpired.
 *   - Passes `UnauthorizedError` (401) to `next(error)` if header is missing, malformed, or token has expired.
 */
export function createAuthMiddleware(tokenService: ITokenService) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.user = resolveAuthenticatedUser(req, tokenService);
      next();
    } catch (error) {
      next(error);
    }
  };
}
