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
 * Express middleware that authenticates a request by verifying the
 * `Authorization: Bearer <token>` header.
 *
 * Per coding guidelines, all header parsing lives in the controller layer
 * (see `bearer-token.extractor.ts`). This middleware delegates to it and
 * only attaches `req.user` on success.
 *
 * On failure (missing/invalid/expired token), it forwards the error.
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
