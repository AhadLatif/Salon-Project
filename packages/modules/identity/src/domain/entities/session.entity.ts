export interface SessionProps {
  id: string;
  userId: string;
  authProviderId: string;
  refreshTokenHash: string;
  deviceName?: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  userAgent?: string | null;
  createdIp?: string | null;
  lastIp?: string | null;
  expiresAt: Date;
  lastUsedAt: Date;
  revokedAt?: Date | null;
  revokeReason?: 'logout' | 'logout_all' | 'compromised' | 'expired' | 'admin' | 'rotated' | null;
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
