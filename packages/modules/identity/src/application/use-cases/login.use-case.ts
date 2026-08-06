import { UnauthorizedError } from '@salon/shared';
import type { UserEntity } from '../../domain/entities/user.entity.js';
import type { IPasswordService } from '../ports/password-service.port.js';
import type { ISessionRepository } from '../ports/session-repository.port.js';
import type { ITokenService } from '../ports/token-service.port.js';
import type { IUserRepository } from '../ports/user-repository.port.js';

export interface LoginCommand {
  email: string;
  passwordPlainText: string;
  deviceName?: string | undefined;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  userAgent?: string | undefined;
  ip?: string | undefined;
}

export interface LoginResult {
  user: UserEntity;
  accessToken: string;
  refreshToken: string;
}

export class LoginUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
    private readonly tokenService: ITokenService,
    private readonly sessionRepository: ISessionRepository,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    // 1. Find user by email
    const user = await this.userRepository.findByEmail(command.email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // 2. Verify password
    const passwordHash = await this.userRepository.findUserPassword(user.id);
    if (!passwordHash) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const passwordMatches = await this.passwordService.compare(
      command.passwordPlainText,
      passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // 3. Find the email auth provider (required by user_sessions FK)
    const authProviderId = await this.userRepository.findEmailAuthProvider(user.id);
    if (!authProviderId) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // 4. Generate opaque refresh token + hash it for storage
    const refreshToken = this.tokenService.generateRefreshToken();
    const refreshTokenHash = this.tokenService.hashRefreshToken(refreshToken);

    // 5. Create a session row (stateful refresh token)
    await this.sessionRepository.create({
      userId: user.id,
      authProviderId,
      refreshTokenHash,
      deviceName: command.deviceName ?? null,
      deviceType: command.deviceType,
      userAgent: command.userAgent ?? null,
      createdIp: command.ip ?? null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // 6. Generate stateless access token
    const tokenPayload = { userId: user.id, email: user.primaryEmail };
    const accessToken = this.tokenService.generateAccessToken(tokenPayload);

    return {
      user,
      accessToken,
      refreshToken,
    };
  }
}
