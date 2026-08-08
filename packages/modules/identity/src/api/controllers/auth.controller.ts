import { ValidationError } from '@salon/shared';
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

  // Controller has only these three tasks:
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Parse the user raw data via zod
      const parseResult = registerUserSchema.safeParse(req.body);

      if (!parseResult.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parseResult.error.issues) {
          const fieldName = issue.path.join('.');
          if (fieldName) {
            fieldErrors[fieldName] = issue.message;
          }
        }

        throw new ValidationError('Invalid registration data', fieldErrors);
      }

      const { firstName, lastName, email, password } = parseResult.data;

      // 2. give that parsed data to the uscase to perform business and other operations
      const result = await this.registerUserUseCase.execute({
        firstName,
        lastName,
        email,
        passwordPlainText: password, // deliberately mapping API → command
      });

      // 3. Respond back to the user
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

  // Login
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = loginSchema.safeParse(req.body);

      if (!parseResult.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parseResult.error.issues) {
          const fieldName = issue.path.join('.');
          if (fieldName) {
            fieldErrors[fieldName] = issue.message;
          }
        }

        throw new ValidationError('Invalid login data', fieldErrors);
      }

      const { email, password, deviceName, deviceType } = parseResult.data;

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

  // Refresh token use case is needed because we are using opaque refresh tokens and
  // refresh token handling can be influenced by business logic, so we handle it in a use case.
  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = refreshTokenSchema.safeParse(req.body);

      if (!parseResult.success) {
        throw new ValidationError('Invalid refresh token');
      }

      const result = await this.refreshTokenUseCase.execute({
        refreshToken: parseResult.data.refreshToken,
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

  // Logout
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = logoutSchema.safeParse(req.body);

      if (!parseResult.success) {
        throw new ValidationError('Invalid refresh token');
      }

      await this.logoutUseCase.execute({
        refreshToken: parseResult.data.refreshToken,
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

  // Protected route: returns the authenticated user's info
  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // req.user is set by the auth middleware
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
