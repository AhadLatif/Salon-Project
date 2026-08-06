import { ConflictError, UnauthorizedError } from '@salon/shared';
import type { UserEntity } from '../../domain/entities/user.entity.js';
import type { IPasswordService } from '../ports/password-service.port.js';
import type { ISessionRepository } from '../ports/session-repository.port.js';
import type { ITokenService } from '../ports/token-service.port.js';
import type { IUserRepository, NewUserPayload } from '../ports/user-repository.port.js';

export interface RegisterUserCommand {
  firstName: string;
  lastName: string;
  email: string;
  passwordPlainText: string;
}

export interface RegisterUserResult {
  user: UserEntity;
  accessToken: string;
  refreshToken: string;
}

export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
    private readonly tokenService: ITokenService,
    private readonly sessionRepository: ISessionRepository,
  ) {}

  async execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
    // 1. Business Rule: Prevent duplicate emails
    const existingUser = await this.userRepository.findByEmail(command.email);
    if (existingUser) {
      throw new ConflictError('A user with this email address already exists.');
    }

    // 2. Hash password via IPasswordService port
    const hashedPassword = await this.passwordService.hash(command.passwordPlainText);

    // 3. Prepare entity payload
    const newUserPayload: NewUserPayload = {
      firstName: command.firstName,
      lastName: command.lastName,
      primaryEmail: command.email,
    };

    // 4. Persist via IUserRepository port (creates user + email auth provider in a transaction)
    const createdUser = await this.userRepository.createWithEmailAuth(
      newUserPayload,
      hashedPassword,
    );

    // 5. Find the email auth provider (required by user_sessions FK)
    const authProviderId = await this.userRepository.findEmailAuthProvider(createdUser.id);
    if (!authProviderId) {
      throw new UnauthorizedError('Failed to create email auth provider');
    }

    // 6. Auto-session: create a session so the user is logged in immediately
    const refreshToken = this.tokenService.generateRefreshToken();
    const refreshTokenHash = this.tokenService.hashRefreshToken(refreshToken);
    await this.sessionRepository.create({
      userId: createdUser.id,
      authProviderId,
      refreshTokenHash,
      deviceType: 'unknown',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // 7. Issue stateless access token
    const tokenPayload = { userId: createdUser.id, email: createdUser.primaryEmail };
    const accessToken = this.tokenService.generateAccessToken(tokenPayload);

    // TODO: In Phase 6 (Event Bus), we will publish a 'UserRegisteredEvent' here
    // so the Notification module can send a welcome email in the background.

    return {
      user: createdUser,
      accessToken,
      refreshToken,
    };
  }
}
