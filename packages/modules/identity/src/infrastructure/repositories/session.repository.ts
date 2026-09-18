import { type db, userSessions } from '@salon/database';
import { and, eq, gt, isNull, or } from 'drizzle-orm';

import type {
  CreateSessionData,
  ISessionRepository,
  SessionRevokeReason,
  SessionRotationOutcome,
  SessionTokenLookup,
  SessionTokenState,
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

  async findByTokenHash(hash: string): Promise<SessionTokenLookup | null> {
    const [session] = await this.database
      .select()
      .from(userSessions)
      .where(
        // Either hash may match: `refresh_token_hash` is the live token, while
        // `previous_refresh_token_hash` is the one we rotated away on the last refresh.
        or(
          eq(userSessions.refreshTokenHash, hash),
          eq(userSessions.previousRefreshTokenHash, hash),
        ),
      );

    if (!session) return null;

    const entity = new SessionEntity(session as SessionProps);

    // The row carries both hashes, so we can classify the match without a second query.
    // "rotated" means the caller presented a token that had already been exchanged.
    const tokenState: SessionTokenState = entity.refreshTokenHash === hash ? 'current' : 'rotated';

    return { session: entity, tokenState };
  }

  /**
   * Rotates a session refresh token using atomic Compare-And-Swap (CAS).
   *
   * Security invariant — the UPDATE is conditioned on all four of:
   * 1. `id = sessionId`              (target session)
   * 2. `refreshTokenHash = expectedHash` (the exact hash the client presented)
   * 3. `revokedAt IS NULL`           (the session is still alive)
   * 4. `expiresAt > now`             (the session has not expired)
   *
   * Because every condition is checked inside the single statement, two concurrent refreshes
   * carrying the same token cannot both succeed: only the first can match `expectedHash`. That
   * atomicity is the whole reason this is done in SQL rather than with an application-level lock.
   *
   * The rotated-away hash is MOVED into `previous_refresh_token_hash` rather than discarded:
   * that one write is what makes later replay detection possible (we can recognise a token we
   * already exchanged) and costs a column instead of a second row per refresh.
   *
   * A failed UPDATE means one of the four guards rejected it — but WHICH one matters, and they
   * are nothing alike. Only a changed hash proves someone else already used this credential;
   * the rest are ordinary ways for a session to die. So on failure we ask the row rather than
   * guessing, because guessing was the original defect: every reason was flattened into `false`
   * and the caller escalated all of them into "revoke every session this user owns".
   *
   * The extra SELECT runs only on the failure path, so the happy path stays a single statement.
   */
  async rotateRefreshToken(
    sessionId: string,
    expectedHash: string,
    newHash: string,
  ): Promise<SessionRotationOutcome> {
    // One timestamp shared by the guarded UPDATE and the classification below, so both agree on
    // what "expired at this moment" means.
    const now = new Date();

    const updated = await this.database
      .update(userSessions)
      .set({
        refreshTokenHash: newHash,
        previousRefreshTokenHash: expectedHash,
        lastUsedAt: now,
      })
      .where(
        and(
          eq(userSessions.id, sessionId),
          eq(userSessions.refreshTokenHash, expectedHash),
          isNull(userSessions.revokedAt),
          gt(userSessions.expiresAt, now),
        ),
      )
      .returning({ id: userSessions.id });

    if (updated.length === 1) return 'rotated';

    const [row] = await this.database
      .select({
        refreshTokenHash: userSessions.refreshTokenHash,
        revokedAt: userSessions.revokedAt,
        expiresAt: userSessions.expiresAt,
      })
      .from(userSessions)
      .where(eq(userSessions.id, sessionId));

    if (!row) return 'not-found';

    // Order matters: the BENIGN explanations are tested first. A session can be both revoked and
    // hold an already-rotated hash; reporting `revoked` is the truthful answer there, whereas
    // reporting `hash-changed` would revoke every session the user owns over an ordinary logout.
    if (row.revokedAt !== null) return 'revoked';

    // Compared against a FRESH timestamp rather than `now`: a later instant can only make expiry
    // more likely to be the answer, and expiry is the benign one. In a tie we prefer the reading
    // that does not nuke the account.
    if (row.expiresAt <= new Date()) return 'expired';

    return 'hash-changed';
  }

  async revoke(sessionId: string, reason: SessionRevokeReason): Promise<void> {
    await this.database
      .update(userSessions)
      .set({
        revokedAt: new Date(),
        revokeReason: reason,
      })
      // Guarded so revocation is idempotent and the FIRST reason wins: without this,
      // a later write (e.g. 'expired' after 'logout') would rewrite history and hide
      // why the session actually ended.
      .where(and(eq(userSessions.id, sessionId), isNull(userSessions.revokedAt)));
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
