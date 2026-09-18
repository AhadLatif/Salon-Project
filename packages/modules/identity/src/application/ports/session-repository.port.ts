import type { SessionEntity } from '../../domain/entities/session.entity.js';

export type SessionRevokeReason = 'logout' | 'logout_all' | 'compromised' | 'expired' | 'admin';

export interface CreateSessionData {
  userId: string;
  authProviderId: string;
  refreshTokenHash: string;
  deviceName?: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  userAgent?: string | null;
  createdIp?: string | null;
  expiresAt: Date;
}

/**
 * Which of a session's two stored hashes a presented refresh token matched.
 *
 * - `current`: the token is the live one — normal rotation.
 * - `rotated`: the token was already exchanged for a newer one. A caller presenting it
 *   is either a stale device or a thief replaying a stolen copy, and only the use case
 *   can tell those apart (stale clients have usually logged out; thieves have not).
 *
 * The repository reports the fact; the policy decision stays in the application layer.
 */
export type SessionTokenState = 'current' | 'rotated';

export interface SessionTokenLookup {
  session: SessionEntity;
  tokenState: SessionTokenState;
}

/**
 * WHY a rotation attempt succeeded or failed.
 *
 * The previous return type was a plain `boolean`, which collapsed four completely different
 * situations into `false`. The caller had no way to tell them apart, so it treated all of them
 * as proof of theft and revoked every session the user owned. That meant a plain logout or an
 * expired session on one device could sign the user out everywhere and label the account
 * `'compromised'` in the audit trail — a false alarm raised by the type system itself.
 *
 * - `rotated`      — success; the token was exchanged atomically.
 * - `hash-changed` — the stored hash no longer matches what was presented, i.e. this exact token
 *                    was already exchanged by someone else. The ONLY genuinely suspicious outcome.
 * - `revoked`      — the session was revoked (logout / admin / earlier compromise) in the window
 *                    between the caller's read and this write. Ordinary and expected.
 * - `expired`      — the session's lifetime ended in that same window. Ordinary and expected.
 * - `not-found`    — the session row no longer exists (e.g. the user was deleted, cascade).
 */
export type SessionRotationOutcome =
  | 'rotated'
  | 'hash-changed'
  | 'revoked'
  | 'expired'
  | 'not-found';

export interface ISessionRepository {
  create(data: CreateSessionData): Promise<SessionEntity>;
  /**
   * Finds a session by EITHER its current or its previously-rotated refresh token hash.
   * Looking up only the current hash would make reuse of an already-rotated token
   * invisible to the caller.
   */
  findByTokenHash(hash: string): Promise<SessionTokenLookup | null>;
  /**
   * Atomic compare-and-swap rotation.
   *
   * Reports WHY it failed instead of a bare `false`, because only one of the failure reasons
   * indicates credential reuse; the others are ordinary session deaths that must not be
   * escalated into "revoke everything". See `SessionRotationOutcome`.
   */
  rotateRefreshToken(
    sessionId: string,
    expectedHash: string,
    newHash: string,
  ): Promise<SessionRotationOutcome>;
  revoke(sessionId: string, reason: SessionRevokeReason): Promise<void>;
  revokeAllForUser(userId: string, reason: SessionRevokeReason): Promise<void>;
}
