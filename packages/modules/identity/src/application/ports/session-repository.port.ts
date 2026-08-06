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

export interface ISessionRepository {
  create(data: CreateSessionData): Promise<SessionEntity>;
  findByRefreshTokenHash(hash: string): Promise<SessionEntity | null>;
  rotateRefreshToken(sessionId: string, newHash: string): Promise<void>;
  revoke(sessionId: string, reason: SessionRevokeReason): Promise<void>;
  revokeAllForUser(userId: string, reason: SessionRevokeReason): Promise<void>;
}
