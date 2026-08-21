import { type db, userSessions } from '@salon/database';
import { and, eq, gt, isNull } from 'drizzle-orm';

import type {
  CreateSessionData,
  ISessionRepository,
  SessionRevokeReason,
} from '../../application/ports/session-repository.port.js';
import { SessionEntity, type SessionProps } from '../../domain/entities/session.entity.js';

export class SessionRepository implements ISessionRepository {
  constructor(private readonly database: typeof db) {}

  async create(data: CreateSessionData): Promise<SessionEntity> {
    const [newSession] = await this.database
      .insert(userSessions)
      .values({
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash,
        authProviderId: data.authProviderId,
        deviceName: data.deviceName,
        deviceType: data.deviceType,
        userAgent: data.userAgent,
        createdIp: data.createdIp,
        expiresAt: data.expiresAt,
      })
      .returning();

    if (!newSession) throw new Error('Failed to create new session');

    return new SessionEntity(newSession as SessionProps);
  }

  async findByRefreshTokenHash(hash: string): Promise<SessionEntity | null> {
    const [session] = await this.database
      .select()
      .from(userSessions)
      .where(eq(userSessions.refreshTokenHash, hash));

    if (!session) return null;

    return new SessionEntity(session as SessionProps);
  }

  /**
   * Rotates a session refresh token using atomic Compare-And-Swap (CAS).
   *
   * Concurrency & Security Invariant:
   * To prevent replay attacks and race conditions, the update is conditioned on:
   * 1. `id = sessionId` (Target session)
   * 2. `refreshTokenHash = expectedHash` (Must match the exact hash presented by the client)
   * 3. `revokedAt IS NULL` (Session has not been revoked)
   * 4. `expiresAt > NOW()` (Session has not expired)
   *
   * If two concurrent refresh requests arrive with the same token, only the FIRST request
   * succeeds in matching `expectedHash`. The second request updates 0 rows and returns `false`,
   * signalling token reuse (which triggers session revocation).
   *
   * @returns `true` if token was rotated atomically, `false` if expectedHash mismatched or session invalid.
   */
  async rotateRefreshToken(
    sessionId: string,
    expectedHash: string,
    newHash: string,
  ): Promise<boolean> {
    const updated = await this.database
      .update(userSessions)
      .set({
        refreshTokenHash: newHash,
        lastUsedAt: new Date(),
      })
      .where(
        and(
          eq(userSessions.id, sessionId),
          eq(userSessions.refreshTokenHash, expectedHash),
          isNull(userSessions.revokedAt),
          gt(userSessions.expiresAt, new Date()),
        ),
      )
      .returning({ id: userSessions.id });

    return updated.length === 1;
  }

  async revoke(sessionId: string, reason: SessionRevokeReason): Promise<void> {
    await this.database
      .update(userSessions)
      .set({
        revokedAt: new Date(),
        revokeReason: reason,
      })
      .where(eq(userSessions.id, sessionId));
  }

  async revokeAllForUser(userId: string, reason: SessionRevokeReason): Promise<void> {
    await this.database
      .update(userSessions)
      .set({
        revokedAt: new Date(),
        revokeReason: reason,
      })
      .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));
  }
}
