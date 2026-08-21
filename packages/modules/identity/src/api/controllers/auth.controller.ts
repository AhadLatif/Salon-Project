import { validateBody } from '@salon/shared';
import type { NextFunction, Request, Response } from 'express';
import type { LoginUseCase } from '../../application/use-cases/login.use-case.js';
import type { LogoutUseCase } from '../../application/use-cases/logout.use-case.js';
import type { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case.js';
import type { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case.js';
import { loginSchema, logoutSchema, refreshTokenSchema } from '../dtos/auth.schema.js';
import { registerUserSchema } from '../dtos/register-user.schema.js';

export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
  ) {}

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
   *          -> UserRepository.create (checks email collision)
   *          -> JwtService.generateTokenPair
   *          -> SessionRepository.createSession
   *
   * @returns 201 Created { success: true, data: { user: { id, email, fullName }, tokens: { accessToken, refreshToken } }, meta: {} }
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

      const result = await this.registerUserUseCase.execute({
        firstName,
        lastName,
        email,
        passwordPlainText: password,
      });

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: result.user.id,
            email: result.user.primaryEmail,
            fullName: result.user.fullName,
          },
          tokens: {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
          },
        },
        meta: {},
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
   * @returns 200 OK { success: true, data: { user: { id, email, fullName }, tokens: { accessToken, refreshToken } }, meta: {} }
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

      const result = await this.loginUseCase.execute({
        email,
        passwordPlainText: password,
        deviceName,
        deviceType,
        userAgent: req.get('user-agent'),
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: result.user.id,
            email: result.user.primaryEmail,
            fullName: result.user.fullName,
          },
          tokens: {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
          },
        },
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Rotates opaque refresh token using atomic Compare-And-Swap (CAS).
   *
   * @http POST /api/v1/auth/refresh
   * @body
   *   - refreshToken: string (opaque raw token)
   *
   * @flow
   *   Client -> AuthController.refresh
   *          -> validateBody(refreshTokenSchema)
   *          -> RefreshTokenUseCase.execute
   *          -> SessionRepository.rotateRefreshToken (atomic CAS exchange of SHA-256 hashes)
   *
   * @returns 200 OK { success: true, data: { tokens: { accessToken, refreshToken } }, meta: {} }
   * @throws 400 Bad Request (Invalid token format)
   * @throws 401 Unauthorized (Token expired, revoked, or already rotated / reused)
   */
  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = validateBody(refreshTokenSchema, req.body, 'Invalid refresh token');

      const result = await this.refreshTokenUseCase.execute({
        refreshToken: data.refreshToken,
      });

      res.status(200).json({
        success: true,
        data: {
          tokens: {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
          },
        },
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Invalidates a user session by revoking the refresh token hash.
   *
   * @http POST /api/v1/auth/logout
   * @body
   *   - refreshToken: string
   *
   * @flow
   *   Client -> AuthController.logout
   *          -> validateBody(logoutSchema)
   *          -> LogoutUseCase.execute
   *          -> SessionRepository.revokeSession
   *
   * @returns 200 OK { success: true, data: null, meta: {} }
   * @throws 400 Bad Request (Missing token)
   */
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = validateBody(logoutSchema, req.body, 'Invalid refresh token');

      await this.logoutUseCase.execute({
        refreshToken: data.refreshToken,
      });

      res.status(200).json({
        success: true,
        data: null,
        meta: {},
      });
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
   *   Client -> authMiddleware (verifies JWT & attaches req.user)
   *          -> AuthController.me
   *
   * @returns 200 OK { success: true, data: { user: { sub, email, ... } }, meta: {} }
   * @throws 401 Unauthorized (Missing or expired Bearer token)
   */
  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({
        success: true,
        data: {
          user: req.user,
        },
        error: null,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  };
}
