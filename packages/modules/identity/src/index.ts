import type { db } from '@salon/database';
import { Router } from 'express';
import { AuthController } from './api/controllers/auth.controller.js';
import {
  buildClearedRefreshCookieOptions,
  buildRefreshCookieOptions,
  type RuntimeEnvironment,
} from './api/cookies/refresh-cookie.js';
import { createAuthMiddleware } from './api/middlewares/auth.middleware.js';
import { LoginUseCase } from './application/use-cases/login.use-case.js';
import { LogoutUseCase } from './application/use-cases/logout.use-case.js';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case.js';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case.js';
import { SESSION_TTL_MS } from './domain/session-policy.js';
import { SessionRepository } from './infrastructure/repositories/session.repository.js';
import { UserRepository } from './infrastructure/repositories/user.repository.js';
import { JwtService } from './infrastructure/services/auth/jwt.service.js';
import { BcryptPasswordService } from './infrastructure/services/auth/password.services.js';

// --- 1. EXPORT ALL PORTS, CLASSES & TYPES (For Testing & Extension) ---
export * from './api/controllers/auth.controller.js';
export * from './api/controllers/bearer-token.extractor.js';
export * from './api/cookies/refresh-cookie.js';
export * from './api/docs/identity.openapi.js';
export * from './api/dtos/auth.schema.js';
export * from './api/dtos/register-user.schema.js';
export * from './api/middlewares/auth.middleware.js';
export * from './application/ports/password-service.port.js';
export * from './application/ports/session-repository.port.js';
export * from './application/ports/token-service.port.js';
export * from './application/ports/user-repository.port.js';
export * from './application/use-cases/login.use-case.js';
export * from './application/use-cases/logout.use-case.js';
export * from './application/use-cases/refresh-token.use-case.js';
export * from './application/use-cases/register-user.use-case.js';
export * from './domain/entities/session.entity.js';
export * from './domain/entities/user.entity.js';
export * from './domain/session-policy.js';
export * from './infrastructure/repositories/session.repository.js';
export * from './infrastructure/repositories/user.repository.js';
export * from './infrastructure/services/auth/jwt.service.js';
export * from './infrastructure/services/auth/password.services.js';

// --- 2. DEFINE MODULE DEPENDENCIES CONTRACT ---
export interface IdentityModuleDependencies {
  database: typeof db;
  jwtSecret: string;
  /**
   * Runtime environment, injected by the composition root (`apps/api`) instead of being
   * read from `process.env` here. It drives cookie safety flags (`Secure`) and nothing else.
   */
  environment: RuntimeEnvironment;
}

export interface IdentityModule {
  authRouter: Router;
  authMiddleware: ReturnType<typeof createAuthMiddleware>;
  useCases: {
    registerUserUseCase: RegisterUserUseCase;
    loginUseCase: LoginUseCase;
    refreshTokenUseCase: RefreshTokenUseCase;
    logoutUseCase: LogoutUseCase;
  };
}

// --- 3. THE MODULE FACTORY (Zero Top-Level Side Effects) ---
export function createIdentityModule(deps: IdentityModuleDependencies): IdentityModule {
  // A. Infrastructure Adapters
  const userRepository = new UserRepository(deps.database);
  const sessionRepository = new SessionRepository(deps.database);
  const passwordService = new BcryptPasswordService();
  const jwtService = new JwtService(deps.jwtSecret);

  // B. Application Use Cases
  const registerUserUseCase = new RegisterUserUseCase(
    userRepository,
    passwordService,
    jwtService,
    sessionRepository,
  );
  const loginUseCase = new LoginUseCase(
    userRepository,
    passwordService,
    jwtService,
    sessionRepository,
  );
  const refreshTokenUseCase = new RefreshTokenUseCase(
    sessionRepository,
    jwtService,
    userRepository,
  );
  const logoutUseCase = new LogoutUseCase(sessionRepository, jwtService);

  // C. API Controllers & Routers
  // Cookie attributes are decided ONCE here (from the injected environment) and shared by the
  // three endpoints that touch the refresh cookie, so "set" and "clear" can never disagree.
  const authController = new AuthController({
    registerUserUseCase,
    loginUseCase,
    refreshTokenUseCase,
    logoutUseCase,
    refreshCookieOptions: buildRefreshCookieOptions(deps.environment, SESSION_TTL_MS),
    clearedRefreshCookieOptions: buildClearedRefreshCookieOptions(deps.environment, SESSION_TTL_MS),
  });
  const authMiddleware = createAuthMiddleware(jwtService);
  const authRouter = Router();

  authRouter.post('/register', authController.register);
  authRouter.post('/login', authController.login);
  authRouter.post('/refresh', authController.refresh);
  authRouter.post('/logout', authController.logout);
  authRouter.get('/me', authMiddleware, authController.me);

  return {
    authRouter,
    authMiddleware,
    useCases: {
      registerUserUseCase,
      loginUseCase,
      refreshTokenUseCase,
      logoutUseCase,
    },
  };
}
