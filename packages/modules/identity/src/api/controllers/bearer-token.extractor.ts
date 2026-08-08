import { UnauthorizedError } from '@salon/shared';
import type { Request } from 'express';
import type { ITokenService, TokenPayload } from '../../application/ports/token-service.port.js';

/**
 * Extracts the `Authorization: Bearer <token>` header from the request and
 * verifies it via the token service.
 *
 * Per coding guidelines, all HTTP header access lives in the module's
 * `api/controllers` layer. Middlewares and use cases must NOT read headers directly.
 *
 * Returns the verified token payload, or throws `UnauthorizedError`.
 */
export function resolveAuthenticatedUser(req: Request, tokenService: ITokenService): TokenPayload {
  const authHeader = req.headers.authorization;

  if (!authHeader?.toLowerCase().startsWith('bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }

  const token = authHeader.slice('Bearer '.length).trim();

  if (!token) {
    throw new UnauthorizedError('Missing access token');
  }

  // verifyToken throws UnauthorizedError on missing/invalid/expired tokens.
  return tokenService.verifyToken(token);
}
