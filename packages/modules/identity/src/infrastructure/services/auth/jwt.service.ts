// packages/modules/identity/src/infrastructure/auth/jwt.service.ts

import { createHash, randomBytes } from 'node:crypto';
import { UnauthorizedError } from '@salon/shared';
import jwt from 'jsonwebtoken';
import type { ITokenService, TokenPayload } from '../../../application/ports/token-service.port.js';
export class JwtService implements ITokenService {
  constructor(private readonly secret: string) {}
  // TODO: In Phase 7 (Configuration Strategy), we will inject a ConfigService here.
  // For now, we fall back to a hardcoded string so you can test locally without crashing.

  /**
   * Generates a short-lived access token (15 minutes).
   * This limits the window of opportunity if a token is stolen.
   */
  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: '15m' });
  }

  /**
   * Generates a long-lived refresh token (7 days).
   * Used to securely request a new access token without forcing the user to log in again.
   */
  generateRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Verifies the token and extracts the payload.
   * Throws our custom UnauthorizedError if it fails.
   */
  verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.secret) as TokenPayload;
    } catch (_error) {
      throw new UnauthorizedError('Invalid or expired authentication token');
    }
  }
}
