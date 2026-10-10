import { UnauthorizedError } from '@salon/shared';
import type { UserEntity } from '../../domain/entities/user.entity.js';
import type { IUserRepository } from '../ports/user-repository.port.js';

export interface GetCurrentUserQuery {
  /** The `userId` claim of an access token that the auth middleware has ALREADY verified. */
  userId: string;
}

/**
 * Resolves the account behind a verified access token.
 *
 * WHY THIS EXISTS: `GET /auth/me` used to echo the JWT claims (`{ userId, email }`). The access token
 * deliberately carries no profile data, so a web client that restored its session through
 * `/auth/refresh` (every page reload) could never learn the user's name — and its `user` object had a
 * different shape from the one login/register return. Reading the row makes `/auth/me` return the
 * same presenter shape as login, from the source of truth rather than from a 15-minute-old snapshot.
 *
 * A valid signature does not prove the account still exists, so a missing row is an authentication
 * failure (401), not a 404: the caller must not be told "this user id is unknown".
 */
export class GetCurrentUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(query: GetCurrentUserQuery): Promise<UserEntity> {
    const user = await this.userRepository.findById(query.userId);
    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }
    return user;
  }
}
