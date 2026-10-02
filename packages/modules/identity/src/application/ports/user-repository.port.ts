import type { UserEntity } from '../../domain/entities/user.entity.js';

/**
 * What `createWithEmailAuth` accepts.
 *
 * WHY THE NULLABLE COLUMNS ARE OPTIONAL: `UserEntity` (a persisted row) has `primaryPhone` /
 * `avatarUrl` as required-but-nullable, whereas the INSERT may omit them — the database defaults them
 * to `NULL`. Those are different contracts, so the create payload is derived from the entity and
 * re-opens exactly the two defaulted columns. Register deliberately sends neither.
 *
 * `Omit` therefore excludes the columns the repository supplies or defaults itself: the generated
 * `id`, the audit timestamps, and `status` (which is defaulted to 'active' unless supplied).
 *
 * ⚠️ NOTE THE `Omit` LIST ALSO INCLUDES THE TWO REOPENED COLUMNS. An intersection does not merge
 * members — `Omit<…, 'id'|…> & Partial<Pick<UserEntity, 'primaryPhone'>>` would still REQUIRE
 * `primaryPhone` (from the first member) and only make it optional in the second, so the payload
 * would not compile. They must be omitted first and re-added as partial.
 */
export type NewUserPayload = Omit<
  UserEntity,
  'id' | 'createdAt' | 'updatedAt' | 'status' | 'primaryPhone' | 'avatarUrl'
> &
  Partial<Pick<UserEntity, 'primaryPhone' | 'avatarUrl'>> & {
    status?: 'active' | 'suspended' | 'deleted';
  };

export interface IUserRepository {
  findByEmail(email: string): Promise<UserEntity | null>;
  findById(id: string): Promise<UserEntity | null>;
  createWithEmailAuth(userData: NewUserPayload, passwordHash: string): Promise<UserEntity>;
  findUserPassword(userId: string): Promise<string | null>;
  findEmailAuthProvider(userId: string): Promise<string | null>;
}
