export interface SessionProps {
  id: string;
  userId: string;
  authProviderId: string;
  refreshTokenHash: string;
  /**
   * Hash of the refresh token that was most recently rotated away.
   *
   * Why we keep it: after rotation the `refreshTokenHash` column holds the NEW token,
   * so the OLD token would be unrecognisable — and an unrecognisable token is
   * indistinguishable from a random string. Keeping the previous hash lets us answer
   * the only question that matters for theft detection: "was this token already
   * exchanged?" (see `RefreshTokenUseCase` reuse detection).
   */
  previousRefreshTokenHash?: string | null;
  deviceName?: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  userAgent?: string | null;
  createdIp?: string | null;
  lastIp?: string | null;
  expiresAt: Date;
  lastUsedAt: Date;
  revokedAt?: Date | null;
  /**
   * Mirrors the `session_revoke_reason` Postgres enum exactly. It must NOT grow a
   * `'rotated'` member: rotation does not revoke a session (the session stays alive
   * and simply holds a new hash), and a type that promises a value the database enum
   * rejects would only compile a runtime failure.
   */
  revokeReason?: 'logout' | 'logout_all' | 'compromised' | 'expired' | 'admin' | null;
  createdAt: Date;
  updatedAt: Date;
}

export class SessionEntity {
  constructor(private readonly props: SessionProps) {}

  get id(): string {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get authProviderId(): string {
    return this.props.authProviderId;
  }
  get refreshTokenHash(): string {
    return this.props.refreshTokenHash;
  }
  get previousRefreshTokenHash(): string | null {
    return this.props.previousRefreshTokenHash ?? null;
  }
  get expiresAt(): Date {
    return this.props.expiresAt;
  }
  get revokedAt(): Date | null {
    return this.props.revokedAt ?? null;
  }
  get revokeReason() {
    return this.props.revokeReason ?? null;
  }

  isActive(): boolean {
    return !this.props.revokedAt && this.props.expiresAt > new Date();
  }
  toPrimitives(): SessionProps {
    return { ...this.props };
  }
}
