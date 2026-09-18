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
    const lookup = await this.sessionRepository.findByTokenHash(refreshTokenHash);

    if (!lookup) return;

    // 2. ONLY the current token may end a session. A presented token that was already
    //    rotated away means the caller is a stale client (e.g. an old tab replaying a
    //    cookie) — letting it revoke the live session would turn a harmless stale
    //    credential into a denial-of-service against the real user.
    if (lookup.tokenState !== 'current') return;

    // 3. Idempotent: logging out an already-revoked session is a no-op (and `revoke`
    //    itself also refuses to overwrite an existing revocation reason).
    if (lookup.session.revokedAt === null) {
      await this.sessionRepository.revoke(lookup.session.id, 'logout');
    }
  }
}
