import { db, userSessions } from '@salon/database';
import { REFRESH_COOKIE_NAME } from '@salon/identity';
import { truncateAllTables } from '@salon/testing';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

/**
 * Extracts the raw refresh-token cookie value from a supertest response.
 * supertest returns `set-cookie` as an array when multiple cookies are set,
 * so we normalise before searching — otherwise the test breaks the moment a
 * second cookie is ever added to the response.
 */
function extractRefreshCookie(response: request.Response): string | null {
  const raw = response.headers['set-cookie'];
  const all = Array.isArray(raw) ? raw.join('; ') : (raw ?? '');
  const match = all.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

/**
 * Registers a user and returns the refresh token from the auto-login session.
 *
 * Register issues its own session (the user is logged in immediately), so calling
 * login afterwards would create a SECOND session and break tests that assert on
 * "the" session row. One call here = exactly one session, which keeps the
 * database assertions deterministic.
 */
async function registerAndLogin(
  app: ReturnType<typeof createApp>,
  email: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const registerResponse = await request(app).post('/api/v1/auth/register').send({
    firstName: 'Test',
    lastName: 'User',
    email,
    password: 'Password123!',
  });

  const refreshToken = extractRefreshCookie(registerResponse);
  if (!refreshToken) throw new Error('Register did not set the refresh cookie');
  return { accessToken: registerResponse.body.data.tokens.accessToken, refreshToken };
}

describe('Auth API Routes Integration Tests', () => {
  const app = createApp();

  beforeEach(async () => {
    await truncateAllTables(db);
  });

  it('POST /api/v1/auth/register - should successfully register a new user', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice.smith@example.com',
      password: 'SecurePassword123!',
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.user.email).toBe('alice.smith@example.com');
    expect(response.body.data.tokens.accessToken).toBeDefined();

    // The hybrid contract: the refresh token travels ONLY in an HttpOnly cookie —
    // it must never appear in the JSON body, or XSS could steal it.
    expect(response.body.data.tokens.refreshToken).toBeUndefined();
    const setCookie = Array.isArray(response.headers['set-cookie'])
      ? response.headers['set-cookie'].join('; ')
      : response.headers['set-cookie'];
    expect(setCookie).toContain(`${REFRESH_COOKIE_NAME}=`);
    expect(setCookie?.toLowerCase()).toContain('httponly');
    expect(setCookie?.toLowerCase()).toContain('samesite=lax');
  });

  it('POST /api/v1/auth/login - should log in existing user with correct password', async () => {
    await request(app).post('/api/v1/auth/register').send({
      firstName: 'Bob',
      lastName: 'Jones',
      email: 'bob.jones@example.com',
      password: 'Password123!',
    });

    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'bob.jones@example.com',
      password: 'Password123!',
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.success).toBe(true);
    expect(loginResponse.body.data.tokens.accessToken).toBeDefined();
    expect(loginResponse.body.data.tokens.refreshToken).toBeUndefined();

    const loginSetCookie = Array.isArray(loginResponse.headers['set-cookie'])
      ? loginResponse.headers['set-cookie'].join('; ')
      : loginResponse.headers['set-cookie'];
    expect(loginSetCookie).toContain(`${REFRESH_COOKIE_NAME}=`);
  });

  it('POST /api/v1/auth/login - should return 401 for incorrect password', async () => {
    await request(app).post('/api/v1/auth/register').send({
      firstName: 'Charlie',
      lastName: 'Brown',
      email: 'charlie@example.com',
      password: 'Password123!',
    });

    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'charlie@example.com',
      password: 'WrongPassword!',
    });

    expect(loginResponse.status).toBe(401);
    expect(loginResponse.body.success).toBe(false);
  });

  it('POST /api/v1/auth/refresh - rotates the token and returns a new access token', async () => {
    const { refreshToken } = await registerAndLogin(app, 'refresh.happy@example.com');

    const refreshResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${refreshToken}`);

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.success).toBe(true);
    expect(refreshResponse.body.data.tokens.accessToken).toBeDefined();
    // The new refresh token is delivered again as a cookie, not in the body.
    expect(refreshResponse.body.data.tokens.refreshToken).toBeUndefined();

    // Rotation: the new cookie value must differ from the old one.
    const newToken = extractRefreshCookie(refreshResponse);
    expect(newToken).toBeDefined();
    expect(newToken).not.toBe(refreshToken);

    // The DB row must hold the NEW hash as current and the OLD hash in the
    // previous slot — that pairing is exactly what makes replay detection work.
    const { createHash } = await import('node:crypto');
    const oldHash = createHash('sha256').update(refreshToken).digest('hex');
    const newHash = createHash('sha256')
      .update(newToken as string)
      .digest('hex');
    const sessionRows = await db.select().from(userSessions);
    expect(sessionRows).toHaveLength(1);
    expect(sessionRows[0]?.refreshTokenHash).toBe(newHash);
    expect(sessionRows[0]?.previousRefreshTokenHash).toBe(oldHash);
  });

  it('POST /api/v1/auth/refresh - detects replay of a rotated token and revokes ALL sessions', async () => {
    const { refreshToken } = await registerAndLogin(app, 'refresh.replay@example.com');

    // First refresh: legitimate rotation.
    const first = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${refreshToken}`);
    expect(first.status).toBe(200);

    // Second refresh with the SAME (now rotated-away) token: the theft signal.
    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${refreshToken}`);
    expect(replay.status).toBe(401);

    // Escalation: reuse of a rotated token revokes every session for the user.
    const sessions = await db.select().from(userSessions);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.revokedAt).not.toBeNull();
    expect(sessions[0]?.revokeReason).toBe('compromised');

    // The NEW token (which the legitimate client received) is dead too —
    // the compromise response invalidates the whole session, forcing a fresh login.
    const newToken = extractRefreshCookie(first);
    expect(newToken).toBeDefined();
    const withNew = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${newToken}`);
    expect(withNew.status).toBe(401);
  });

  it('POST /api/v1/auth/logout - revokes the session and clears the cookie', async () => {
    const { refreshToken } = await registerAndLogin(app, 'logout.test@example.com');

    const logoutResponse = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${refreshToken}`);

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.success).toBe(true);

    // The session must be revoked with the benign 'logout' reason — NOT
    // 'compromised', because a logout is user intent, not theft.
    const sessions = await db.select().from(userSessions);
    expect(sessions[0]?.revokedAt).not.toBeNull();
    expect(sessions[0]?.revokeReason).toBe('logout');

    // The cookie must be cleared (expired in the past).
    const cleared = Array.isArray(logoutResponse.headers['set-cookie'])
      ? logoutResponse.headers['set-cookie'].join('; ')
      : logoutResponse.headers['set-cookie'];
    expect(cleared).toMatch(new RegExp(`${REFRESH_COOKIE_NAME}=;`));

    // Refreshing with the revoked token is refused — a plain 401, WITHOUT
    // escalation (a logout must never look like a compromise).
    const afterLogout = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${refreshToken}`);
    expect(afterLogout.status).toBe(401);
  });

  it('POST /api/v1/auth/refresh - accepts a body refresh token for non-browser clients', async () => {
    const { refreshToken } = await registerAndLogin(app, 'native.client@example.com');

    // Native apps keep the token in secure platform storage and send it in the
    // body. This fallback is safe because no response body ever carries the token.
    const refreshResponse = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.data.tokens.accessToken).toBeDefined();
    expect(extractRefreshCookie(refreshResponse)).toBeDefined();
  });

  it('POST /api/v1/auth/refresh - returns 401 when no token is presented', async () => {
    const response = await request(app).post('/api/v1/auth/refresh');
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('POST /api/v1/auth/refresh - returns 401 for an unknown token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=totally-made-up-token`);
    expect(response.status).toBe(401);
  });
});
