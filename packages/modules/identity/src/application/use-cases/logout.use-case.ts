import type { ISessionRepository } from '../ports/session-repository.port.js';
import type { ITokenService } from '../ports/token-service.port.js';

export interface LogoutCommand {
  refreshToken: string;
}

export class LogoutUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly tokenService: ITokenService,
  ) {}

  async execute(command: LogoutCommand): Promise<void> {
    // 1. Hash the presented refresh token to look up the session
    const refreshTokenHash = this.tokenService.hashRefreshToken(command.refreshToken);
    const session = await this.sessionRepository.findByRefreshTokenHash(refreshTokenHash);

    // 2. If the session exists and isn't already revoked, revoke it.
    //    Idempotent: logging out an already-revoked session is a no-op.
    if (session && session.revokedAt === null) {
      await this.sessionRepository.revoke(session.id, 'logout');
    }
  }
}
