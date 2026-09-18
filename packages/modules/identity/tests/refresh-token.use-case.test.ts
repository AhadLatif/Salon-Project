import { UnauthorizedError } from '@salon/shared';
import { describe, expect, it, vi } from 'vitest';
import type {
  ISessionRepository,
  SessionRotationOutcome,
} from '../src/application/ports/session-repository.port.js';
import type { ITokenService } from '../src/application/ports/token-service.port.js';
import type { IUserRepository } from '../src/application/ports/user-repository.port.js';
import { RefreshTokenUseCase } from '../src/application/use-cases/refresh-token.use-case.js';
import { SessionEntity, type SessionProps } from '../src/domain/entities/session.entity.js';
import { UserEntity } from '../src/domain/entities/user.entity.js';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const SESSION_ID = '22222222-2222-2222-2222-222222222222';
const AUTH_PROVIDER_ID = '33333333-3333-3333-3333-333333333333';

/** The token the client presents, plus the hash the database would hold for it. */
const PRESENTED_TOKEN = 'presented-refresh-token';
const hashOf = (token: string): string => `sha256:${token}`;
const PRESENTED_HASH = hashOf(PRESENTED_TOKEN);

const buildSession = (overrides: Partial<SessionProps> = {}): SessionEntity =>
  new SessionEntity({
    id: SESSION_ID,
    userId: USER_ID,
    authProviderId: AUTH_PROVIDER_ID,
    refreshTokenHash: PRESENTED_HASH,
    previousRefreshTokenHash: null,
    deviceType: 'desktop',
    expiresAt: new Date(Date.now() + 60_000),
    lastUsedAt: new Date(),
    revokedAt: null,
    revokeReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

const buildUser = (): UserEntity =>
  new UserEntity({
    id: USER_ID,
    firstName: 'Ada',
    lastName: 'Lovelace',
    primaryEmail: 'ada@example.com',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

interface Setup {
  /** What the compare-and-swap rotation reports back. */
  rotation: SessionRotationOutcome;
  /** Which of the session's two stored hashes the presented token matched. */
  tokenState?: 'current' | 'rotated';
  /** The session was already revoked before the request arrived. */
  alreadyRevoked?: boolean;
  /** The session's lifetime had already ended before the request arrived. */
  alreadyExpired?: boolean;
  /** No session matches the presented token at all. */
  unknownToken?: boolean;
}

/**
 * Wires the use case against stubbed ports.
 *
 * Only the POLICY is under test here: given a particular rotation outcome, does the use case
 * revoke every session the user owns? The repository's own job — deciding WHICH outcome applies
 * by inspecting the row — belongs to its integration tests, not to this file.
 */
const createUseCase = (setup: Setup) => {
  const sessionRepository: ISessionRepository = {
    create: vi.fn(),
    findByTokenHash: vi.fn().mockResolvedValue(
      setup.unknownToken
        ? null
        : {
            session: buildSession({
              revokedAt: setup.alreadyRevoked ? new Date() : null,
              revokeReason: setup.alreadyRevoked ? 'logout' : null,
              expiresAt: new Date(Date.now() + (setup.alreadyExpired ? -60_000 : 60_000)),
            }),
            tokenState: setup.tokenState ?? 'current',
          },
    ),
    rotateRefreshToken: vi.fn().mockResolvedValue(setup.rotation),
    revoke: vi.fn().mockResolvedValue(undefined),
    revokeAllForUser: vi.fn().mockResolvedValue(undefined),
  };

  const tokenService: ITokenService = {
    generateAccessToken: vi.fn().mockReturnValue('new-access-token'),
    generateRefreshToken: vi.fn().mockReturnValue('new-refresh-token'),
    hashRefreshToken: vi.fn().mockImplementation(hashOf),
    verifyToken: vi.fn(),
  };

  const userRepository: IUserRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn().mockResolvedValue(buildUser()),
    createWithEmailAuth: vi.fn(),
    findUserPassword: vi.fn(),
    findEmailAuthProvider: vi.fn(),
  };

  return {
    useCase: new RefreshTokenUseCase(sessionRepository, tokenService, userRepository),
    sessionRepository,
  };
};

describe('RefreshTokenUseCase — which rotation outcomes justify revoking every session', () => {
  it('issues new tokens and does not escalate when rotation succeeds', async () => {
    const { useCase, sessionRepository } = createUseCase({ rotation: 'rotated' });

    const result = await useCase.execute({ refreshToken: PRESENTED_TOKEN });

    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBe('new-refresh-token');
    expect(sessionRepository.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('escalates when the presented token had already been exchanged (hash-changed)', async () => {
    const { useCase, sessionRepository } = createUseCase({ rotation: 'hash-changed' });

    await expect(useCase.execute({ refreshToken: PRESENTED_TOKEN })).rejects.toThrow(
      UnauthorizedError,
    );

    expect(sessionRepository.revokeAllForUser).toHaveBeenCalledWith(USER_ID, 'compromised');
  });

  // The three cases below are precisely the false-alarm defect. Each used to reach
  // revokeAllForUser('compromised') only because the repository could say nothing but `false`,
  // signing the user out of every device over an ordinary session death.
  it('does NOT escalate when the session was revoked concurrently (e.g. logout elsewhere)', async () => {
    const { useCase, sessionRepository } = createUseCase({ rotation: 'revoked' });

    await expect(useCase.execute({ refreshToken: PRESENTED_TOKEN })).rejects.toThrow(
      UnauthorizedError,
    );

    expect(sessionRepository.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('does NOT escalate when the session expired concurrently', async () => {
    const { useCase, sessionRepository } = createUseCase({ rotation: 'expired' });

    await expect(useCase.execute({ refreshToken: PRESENTED_TOKEN })).rejects.toThrow(
      UnauthorizedError,
    );

    expect(sessionRepository.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('does NOT escalate when the session row no longer exists', async () => {
    const { useCase, sessionRepository } = createUseCase({ rotation: 'not-found' });

    await expect(useCase.execute({ refreshToken: PRESENTED_TOKEN })).rejects.toThrow(
      UnauthorizedError,
    );

    expect(sessionRepository.revokeAllForUser).not.toHaveBeenCalled();
  });
});

describe('RefreshTokenUseCase — the read-phase guards still hold', () => {
  it('rejects an already-revoked session without escalating and without attempting rotation', async () => {
    const { useCase, sessionRepository } = createUseCase({
      rotation: 'rotated',
      alreadyRevoked: true,
    });

    await expect(useCase.execute({ refreshToken: PRESENTED_TOKEN })).rejects.toThrow(
      UnauthorizedError,
    );

    expect(sessionRepository.rotateRefreshToken).not.toHaveBeenCalled();
    expect(sessionRepository.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('treats a previously-rotated token as theft and escalates', async () => {
    const { useCase, sessionRepository } = createUseCase({
      rotation: 'rotated',
      tokenState: 'rotated',
    });

    await expect(useCase.execute({ refreshToken: PRESENTED_TOKEN })).rejects.toThrow(
      UnauthorizedError,
    );

    expect(sessionRepository.revokeAllForUser).toHaveBeenCalledWith(USER_ID, 'compromised');
  });

  it('marks an expired-but-not-revoked session as expired, without escalating', async () => {
    const { useCase, sessionRepository } = createUseCase({
      rotation: 'rotated',
      alreadyExpired: true,
    });

    await expect(useCase.execute({ refreshToken: PRESENTED_TOKEN })).rejects.toThrow(
      UnauthorizedError,
    );

    expect(sessionRepository.revoke).toHaveBeenCalledWith(SESSION_ID, 'expired');
    expect(sessionRepository.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('rejects a token that matches no session at all', async () => {
    const { useCase, sessionRepository } = createUseCase({
      rotation: 'rotated',
      unknownToken: true,
    });

    await expect(useCase.execute({ refreshToken: 'unknown-token' })).rejects.toThrow(
      UnauthorizedError,
    );

    expect(sessionRepository.rotateRefreshToken).not.toHaveBeenCalled();
  });
});
