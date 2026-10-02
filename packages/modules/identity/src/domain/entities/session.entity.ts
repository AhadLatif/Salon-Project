/**
 * A refresh-token session for one device.
 *
 * CONTRACT — maps 1:1 onto the `user_sessions` row.
 *
 * WHY AN INTERFACE RATHER THAN A CLASS: the old `SessionEntity` held its state in a private `props`
 * bag and only re-exposed it through getters, so at runtime it was `{ props: {...} }` — a wrapper no
 * serializer would have flattened. It carried no invariants to protect, so it is a shape.
 */
export interface SessionEntity {
  id: string;
  userId: string;
  authProviderId: string;
  refreshTokenHash: string;
  /**
   * Hash of the refresh token that was most recently rotated away.
   *
   * Why we keep it: after rotation the `refreshTokenHash` column holds the NEW token, so the OLD token
   * would be unrecognisable — and an unrecognisable token is indistinguishable from a random string.
   * Keeping the previous hash lets us answer the only question that matters for theft detection:
   * "was this token already exchanged?" (see `RefreshTokenUseCase` reuse detection).
   */
  previousRefreshTokenHash: string | null;
  deviceName: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  userAgent: string | null;
  createdIp: string | null;
  lastIp: string | null;
  expiresAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
  /**
   * Mirrors the `session_revoke_reason` Postgres enum exactly. It must NOT grow a `'rotated'` member:
   * rotation does not revoke a session (the session stays alive and simply holds a new hash), and a type
   * that promises a value the database enum rejects would only compile a runtime failure.
   */
  revokeReason: 'logout' | 'logout_all' | 'compromised' | 'expired' | 'admin' | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Whether a session may still be used: not revoked and not expired.
 *
 * This was `SessionEntity.isActive()`. It is kept as a pure function rather than deleted, because it
 * encodes the security-relevant definition of a live session and something in the auth flow will
 * eventually need it. NOTE: it currently has no callers — the rotation flow compares tokens and
 * timestamps directly. Delete it only when you are certain that stays true.
 */
export function isSessionActive(session: SessionEntity): boolean {
  return !session.revokedAt && session.expiresAt > new Date();
}
