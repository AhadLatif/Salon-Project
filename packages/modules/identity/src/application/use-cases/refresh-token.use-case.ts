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
    // ---------- READ PHASE: nothing is mutated until every prerequisite is confirmed ----------

    // 1. Locate the session by the presented token's hash. The lookup also matches the
    //    PREVIOUS hash, so a token that was already rotated away is still recognisable
    //    (and can be reported as replay) instead of looking like an unknown string.
    const presentedHash = this.tokenService.hashRefreshToken(command.refreshToken);
    const lookup = await this.sessionRepository.findByTokenHash(presentedHash);

    if (!lookup) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const { session, tokenState } = lookup;

    // 2. A revoked session is refused plainly — with NO escalation. Logout, expiry and
    //    admin actions are all legitimate ways for a session to die. Treating any of
    //    them as a compromise would let one stale cookie (or a flaky retry) log the user
    //    out of every device. Only actual token REUSE (step 4) justifies that response.
    if (session.revokedAt !== null) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // 3. Expiry is checked before rotation so a session can never be revived by refreshing.
    if (session.expiresAt < new Date()) {
      await this.sessionRepository.revoke(session.id, 'expired');
      throw new UnauthorizedError('Invalid refresh token');
    }

    // 4. REUSE DETECTION: the presented token matched the hash we already rotated away,
    //    yet the session is still active. The legitimate client proved it received the
    //    rotation (it holds the newer token), so this request carries a COPY of the old
    //    token — i.e. theft. Kill every session for the user and force a fresh login.
    if (tokenState === 'rotated') {
      await this.sessionRepository.revokeAllForUser(session.userId, 'compromised');
      throw new UnauthorizedError('Invalid refresh token');
    }

    // 5. Resolve the user BEFORE mutating anything. Rotating first and failing to load
    //    the user afterwards would leave the client holding a token the database no
    //    longer knows about: session bricked, forced re-login, no way to recover.
    const user = await this.userRepository.findById(session.userId);
    if (!user) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // ---------- WRITE PHASE ----------

    // 6. Rotate with compare-and-swap: the UPDATE only matches while the stored hash is still
    //    exactly the one we read, and it moves that hash into the `previous` slot so a later
    //    replay of this token stays detectable. Two concurrent refreshes with the same token
    //    therefore cannot both succeed — only one of them can match the stored hash.
    const newRefreshToken = this.tokenService.generateRefreshToken();
    const newRefreshTokenHash = this.tokenService.hashRefreshToken(newRefreshToken);
    const outcome = await this.sessionRepository.rotateRefreshToken(
      session.id,
      presentedHash,
      newRefreshTokenHash,
    );

    // 7. Escalate ONLY on a changed hash.
    //
    //    `hash-changed` is the one outcome that proves this exact token had already been
    //    exchanged while the session stayed alive — two holders of one credential, i.e. theft.
    //    For that we revoke every session the user owns and force a fresh login.
    //
    //    Every other outcome is an ordinary way for a session to end: revoked by a logout or an
    //    admin action, or past its expiry. None of them is something the caller did wrong.
    //    Escalating there would sign the user out of every device and write a false
    //    `'compromised'` into the audit trail, so the user experiences a random logout and real
    //    theft alarms get lost in the noise.
    if (outcome !== 'rotated') {
      if (outcome === 'hash-changed') {
        await this.sessionRepository.revokeAllForUser(session.userId, 'compromised');
      }
      throw new UnauthorizedError('Invalid refresh token');
    }

    return {
      accessToken: this.tokenService.generateAccessToken({
        userId: user.id,
        email: user.primaryEmail,
      }),
      refreshToken: newRefreshToken,
    };
  }
}
