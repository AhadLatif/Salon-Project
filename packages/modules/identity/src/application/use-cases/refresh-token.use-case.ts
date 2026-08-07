import { UnauthorizedError } from '@salon/shared';
import type { ISessionRepository } from '../ports/session-repository.port.js';
import type { ITokenService } from '../ports/token-service.port.js';
import type { IUserRepository } from '../ports/user-repository.port.js';

export interface RefreshTokenCommand {
  refreshToken: string;
}

export interface RefreshTokenResult {
  accessToken: string;
  refreshToken: string;
}

export class RefreshTokenUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly tokenService: ITokenService,
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<RefreshTokenResult> {
    // 1. Hash the presented refresh token to look up the session
    const refreshTokenHash = this.tokenService.hashRefreshToken(command.refreshToken);
    const session = await this.sessionRepository.findByRefreshTokenHash(refreshTokenHash);

    if (!session) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // 2. REUSE DETECTION: if the session is already revoked, check the reason.
    //    - 'rotated' or 'compromised' → real reuse, revoke all sessions
    //    - 'logout', 'expired', 'admin' → benign, just reject
    if (session.revokedAt !== null) {
      if (session.revokeReason === 'rotated' || session.revokeReason === 'compromised') {
        await this.sessionRepository.revokeAllForUser(session.userId, 'compromised');
      }
      throw new UnauthorizedError('Invalid refresh token');
    }

    // 3. Check expiry
    if (session.expiresAt < new Date()) {
      await this.sessionRepository.revoke(session.id, 'expired');
      throw new UnauthorizedError('Invalid refresh token');
    }

    // 4. Fetch the user FIRST (read-only, safe to fail before any write)
    const user = await this.userRepository.findById(session.userId);
    if (!user) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // 5. Rotate: generate a new opaque refresh token, store its hash (compare-and-swap)
    const newRefreshToken = this.tokenService.generateRefreshToken();
    const newRefreshTokenHash = this.tokenService.hashRefreshToken(newRefreshToken);
    const rotated = await this.sessionRepository.rotateRefreshToken(
      session.id,
      refreshTokenHash,
      newRefreshTokenHash,
    );

    if (!rotated) {
      // The session was modified between our read and update (race condition or reuse)
      await this.sessionRepository.revokeAllForUser(session.userId, 'compromised');
      throw new UnauthorizedError('Invalid refresh token');
    }

    const accessToken = this.tokenService.generateAccessToken({
      userId: user.id,
      email: user.primaryEmail,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }
}
