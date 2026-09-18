import { respondOk, UnauthorizedError, validateBody } from '@salon/shared';
import type { CookieOptions, NextFunction, Request, Response } from 'express';
import type { LoginUseCase } from '../../application/use-cases/login.use-case.js';
import type { LogoutUseCase } from '../../application/use-cases/logout.use-case.js';
import type { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case.js';
import type { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case.js';
import { REFRESH_COOKIE_NAME } from '../cookies/refresh-cookie.js';
import { loginSchema, refreshTokenSchema } from '../dtos/auth.schema.js';
import { registerUserSchema } from '../dtos/register-user.schema.js';

/**
 * Cookie attributes are injected rather than read from `process.env` here, for two reasons:
 *  1. `process.env` inside a module makes behaviour untestable (you cannot simulate
 *     production cookie flags in a test without mutating global state), and
 *  2. the cookie contract is derived once at wiring time (see `createIdentityModule`), so
 *     there is exactly one place that decides how sessions are stored in the browser.
 */
export interface AuthControllerDependencies {
  registerUserUseCase: RegisterUserUseCase;
  loginUseCase: LoginUseCase;
  refreshTokenUseCase: RefreshTokenUseCase;
  logoutUseCase: LogoutUseCase;
  /** Attributes used when ISSUING the refresh cookie. */
  refreshCookieOptions: CookieOptions;
  /** Attributes used when CLEARING it (must match, minus `maxAge`). */
  clearedRefreshCookieOptions: CookieOptions;
}

/**
 * AUTH CONTROLLER — the HTTP edge of the hybrid session model.
 *
 * Contract (locked with the frontend, see `docs/30-frontend/10-design/05-security-and-auth.md`):
 * - The ACCESS token is returned in the JSON body and kept in memory by the client; it is
 *   sent back as `Authorization: Bearer <token>`. Short-lived and never persisted.
 * - The REFRESH token is delivered ONLY as an HttpOnly cookie. It is never serialised into a
 *   response body, which is what makes it unreachable from JavaScript and therefore from XSS.
 *
 * Every response below must keep that split: an endpoint that leaks the refresh token into a
 * body silently downgrades the whole model back to "the browser holds a long-lived token in JS".
 */
export class AuthController {
  constructor(private readonly deps: AuthControllerDependencies) {}

  /**
   * Resolves the refresh token presented by the caller: cookie first, then request body.
   *
   * The cookie is the primary channel for browsers. The body fallback exists for non-browser
   * clients (native apps) that keep the token in platform secure storage, which is how the
   * authentication strategy describes mobile clients.
   *
   * The fallback is safe precisely BECAUSE no response body ever contains the token: since
   * JavaScript never receives it, accepting it from a body grants an XSS attacker nothing.
   *
   * The body is parsed through Zod rather than trusted directly, and a missing/invalid token
   * is reported as `null` (the caller turns it into a 401) instead of a 400: a cookie-less
   * client that sends nothing is failing authentication, not malforming the request.
   */
  private readRefreshToken(req: Request): string | null {
    const fromCookie = req.cookies?.[REFRESH_COOKIE_NAME];
    if (typeof fromCookie === 'string' && fromCookie.length > 0) {
      return fromCookie;
    }

    const parsedBody = refreshTokenSchema.safeParse(req.body);
    return parsedBody.success ? parsedBody.data.refreshToken : null;
  }

  /**
   * Registers a new platform user and issues an initial JWT session pair.
   *
   * @http POST /api/v1/auth/register
   * @body
   *   - firstName: string (1-100 chars)
   *   - lastName: string (1-100 chars)
   *   - email: string (valid email)
   *   - password: string (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char)
   *
   * @flow
   *   Client -> httpLoggerMiddleware -> express.json()
   *          -> AuthController.register
   *          -> validateBody(registerUserSchema)
   *          -> RegisterUserUseCase.execute
   *          -> UserRepository.createWithEmailAuth (transactional, checks email collision)
   *          -> JwtService.generateAccessToken / generateRefreshToken
   *          -> SessionRepository.create
   *
   * @returns 201 Created { success: true, data: { user: { id, email, fullName }, tokens: { accessToken } }, error: null, meta: {} }
   *          plus `Set-Cookie: salon_refresh_token=...` (HttpOnly).
   *          NOTE: the response body deliberately contains NO refresh token.
   * @throws 400 Bad Request (Validation failed)
   * @throws 409 Conflict (User with this email already exists)
   */
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { firstName, lastName, email, password } = validateBody(
        registerUserSchema,
        req.body,
        'Invalid registration data',
      );

      const result = await this.deps.registerUserUseCase.execute({
        firstName,
        lastName,
        email,
        passwordPlainText: password,
      });

      // 1. Hand the refresh token to the browser as an HttpOnly cookie (never in the body).
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, this.deps.refreshCookieOptions);

      // 2. Return only the access token — the client keeps it in memory.
      respondOk(res, 201, {
        user: {
          id: result.user.id,
          email: result.user.primaryEmail,
          fullName: result.user.fullName,
        },
        tokens: {
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Authenticates user credentials and creates a stateful session.
   *
   * @http POST /api/v1/auth/login
   * @body
   *   - email: string
   *   - password: string
   *   - deviceName?: string
   *   - deviceType?: 'desktop' | 'mobile' | 'tablet' | 'unknown'
   *
   * @flow
   *   Client -> httpLoggerMiddleware -> express.json()
   *          -> AuthController.login
   *          -> validateBody(loginSchema)
   *          -> LoginUseCase.execute (extracts IP & User-Agent from req)
   *          -> UserRepository.findByEmail
   *          -> BcryptService.compare (constant-time verification)
   *          -> SessionRepository.createSession
   *
   * @returns 200 OK { success: true, data: { user: { id, email, fullName }, tokens: { accessToken } }, error: null, meta: {} }
   *          plus `Set-Cookie: salon_refresh_token=...` (HttpOnly).
   * @throws 400 Bad Request (Malformed request body)
   * @throws 401 Unauthorized (Invalid email or password)
   */
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, deviceName, deviceType } = validateBody(
        loginSchema,
        req.body,
        'Invalid login data',
      );

      const result = await this.deps.loginUseCase.execute({
        email,
        passwordPlainText: password,
        deviceName,
        deviceType,
        // IP and User-Agent are read from the HTTP request, never from the body: they are
        // properties of the connection and the client could otherwise forge the audit trail.
        userAgent: req.get('user-agent'),
        ip: req.ip,
      });

      // 1. Hand the refresh token to the browser as an HttpOnly cookie (never in the body).
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, this.deps.refreshCookieOptions);

      // 2. Return only the access token — the client keeps it in memory.
      respondOk(res, 200, {
        user: {
          id: result.user.id,
          email: result.user.primaryEmail,
          fullName: result.user.fullName,
        },
        tokens: {
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Rotates the refresh token using atomic Compare-And-Swap (CAS).
   *
   * @http POST /api/v1/auth/refresh
   * @cookies
   *   - salon_refresh_token: string (HttpOnly, Path=/api/v1/auth)
   * @body (optional)
   *   - refreshToken: string — only for non-browser clients; the cookie wins if both are sent.
   *
   * @flow
   *   Client -> AuthController.refresh
   *          -> readRefreshToken (cookie, else validated body)
   *          -> RefreshTokenUseCase.execute
   *          -> SessionRepository.findByTokenHash (detects replay of a rotated token)
   *          -> SessionRepository.rotateRefreshToken (atomic CAS)
   *
   * @returns 200 OK { success: true, data: { tokens: { accessToken } }, error: null, meta: {} }
   *          plus `Set-Cookie: salon_refresh_token=<new token>` (HttpOnly).
   *          NOTE: the rotated refresh token is returned ONLY in the cookie.
   * @throws 401 Unauthorized (Missing, expired, revoked, or reused refresh token)
   */
  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Resolve the presented token (cookie first, then body for native clients).
      const refreshToken = this.readRefreshToken(req);

      // 2. No token at all is an authentication failure, not a malformed request.
      if (!refreshToken) {
        throw new UnauthorizedError('Refresh token is required');
      }

      // 3. Rotate in the database via atomic CAS (also detects reuse).
      const result = await this.deps.refreshTokenUseCase.execute({ refreshToken });

      // 4. Send the NEW refresh token back in the same HttpOnly cookie slot, so the browser
      //    silently replaces the old value and the client never has to handle the token.
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, this.deps.refreshCookieOptions);

      // 5. Return the new access token in JSON (the client stores it in memory).
      respondOk(res, 200, {
        tokens: {
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Ends the current session and clears the refresh cookie.
   *
   * @http POST /api/v1/auth/logout
   * @cookies
   *   - salon_refresh_token: string (HttpOnly)
   * @body (optional)
   *   - refreshToken: string — only for non-browser clients; the cookie wins if both are sent.
   *
   * @flow
   *   Client -> AuthController.logout
   *          -> readRefreshToken (cookie, else validated body)
   *          -> LogoutUseCase.execute (revokes the CURRENT session only)
   *          -> res.clearCookie
   *
   * @returns 200 OK { success: true, data: null, error: null, meta: {} } — always, even when nothing was
   *          revoked, so the client can always reach a "signed out" state without retry logic.
   */
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Resolve the presented token; a missing token is NOT an error here (see @returns).
      const refreshToken = this.readRefreshToken(req);

      // 2. Revoke server-side if we can identify the session. The use case refuses to revoke
      //    from an already-rotated (stale) token, so a stale cookie cannot kill a live session.
      if (refreshToken) {
        await this.deps.logoutUseCase.execute({ refreshToken });
      }

      // 3. Always clear the cookie, even if the token was missing/invalid: leaving it in the
      //    browser would keep sending a credential the server has already rejected.
      res.clearCookie(REFRESH_COOKIE_NAME, this.deps.clearedRefreshCookieOptions);

      respondOk(res, 200, null);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Returns authenticated user profile claims from the verified JWT access token.
   *
   * @http GET /api/v1/auth/me
   * @headers
   *   - Authorization: Bearer <accessToken>
   *
   * @flow
   *   Client -> authMiddleware (verifies JWT & attaches req.user)Signed Integer Representation: Do they understand that the 8th bit (the MSB) acts as the sign flag for a register, and do they know that anything below hex 80 (binary 1000 0000) is positive?
   *          -> AuthController.me
   *
   * @returns 200 OK { success: true, data: { user: { sub, email, ... } }, error: null, meta: {} }
   * @throws 401 Unauthorized (Missing or expired Bearer token)
   */
  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      respondOk(res, 200, {
        user: req.user,
      });
    } catch (error) {
      next(error);
    }
  };
}
