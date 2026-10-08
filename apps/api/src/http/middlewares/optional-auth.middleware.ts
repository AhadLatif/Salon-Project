import { type ITokenVerifier, resolveAuthenticatedUser } from '@salon/identity';
import { UnauthorizedError } from '@salon/shared';
import type { NextFunction, Request, Response } from 'express';

/**
 * OPTIONAL AUTHENTICATION MIDDLEWARE
 *
 * Verifies a JWT when one is presented:
 * - valid   → attaches `req.user` and continues
 * - missing / invalid / expired → continues **anonymously** (never 401s)
 * - anything else (a bug, a DB error) → forwarded to the error handler
 *
 * The last rule is the important one: swallowing every error would silently downgrade an
 * internal failure to "anonymous guest", which is both misleading and undiscoverable.
 *
 * It takes `ITokenVerifier` rather than the full token service: this middleware must be able
 * to read a token, never to mint one.
 */
export function createOptionalAuthMiddleware(tokenService: ITokenVerifier) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // Same extractor the Identity module uses — no second implementation of token rules.
      req.user = resolveAuthenticatedUser(req, tokenService);
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) {
        next(error);
        return;
      }
      // No usable token: this is the expected anonymous path, not an error.
    }
    next();
  };
}
