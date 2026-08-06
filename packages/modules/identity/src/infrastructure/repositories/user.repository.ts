import { type db, userAuthProviders, users } from '@salon/database';
import { and, eq } from 'drizzle-orm';

import type {
  IUserRepository,
  NewUserPayload,
} from '../../application/ports/user-repository.port.js';
import { UserEntity, type UserProps } from '../../domain/entities/user.entity.js';

export class UserRepository implements IUserRepository {
  constructor(private readonly database: typeof db) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    const [record] = await this.database.select().from(users).where(eq(users.primaryEmail, email));

    if (!record) return null;

    return new UserEntity(record as UserProps);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const [record] = await this.database.select().from(users).where(eq(users.id, id));

    if (!record) return null;

    return new UserEntity(record as UserProps);
  }

  async createWithEmailAuth(userData: NewUserPayload, passwordHash: string): Promise<UserEntity> {
    // Transaction ensures both records succeed, or neither do.
    const createdRecord = await this.database.transaction(async (tx) => {
      // 1. Insert into users table
      const [newUser] = await tx
        .insert(users)
        .values({
          firstName: userData.firstName,
          lastName: userData.lastName,
          primaryEmail: userData.primaryEmail,
          status: userData.status || 'active',
        })
        .returning();

      if (!newUser) throw new Error('Failed to create user record.');

      // 2. Insert into user_auth_providers table
      await tx.insert(userAuthProviders).values({
        userId: newUser.id,
        provider: 'email',
        providerUserId: newUser.primaryEmail, // Using email as the provider ID for standard auth
        providerEmail: newUser.primaryEmail,
        passwordHash: passwordHash,
      });

      return newUser;
    });

    // you can't just return `record` because the port promises a `UserEntity`,
    // and the entity adds behavior (`fullName`, `isActive`) that a raw row doesn't have.
    return new UserEntity(createdRecord as UserProps);
  }

  async findUserPassword(userId: string): Promise<string | null> {
    const [record] = await this.database
      .select({ password: userAuthProviders.passwordHash })
      .from(userAuthProviders)
      .where(and(eq(userAuthProviders.userId, userId), eq(userAuthProviders.provider, 'email')));

    return record?.password ?? null;
  }

  async findEmailAuthProvider(userId: string): Promise<string | null> {
    const [record] = await this.database
      .select({ id: userAuthProviders.id })
      .from(userAuthProviders)
      .where(and(eq(userAuthProviders.userId, userId), eq(userAuthProviders.provider, 'email')));

    return record?.id ?? null;
  }
}
