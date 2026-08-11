import { db } from '@salon/database';
import { createTestUser, truncateAllTables } from '@salon/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UserRepository } from '../src/infrastructure/repositories/user.repository.js';

describe('UserRepository Integration Tests', () => {
  let userRepository: UserRepository;

  beforeEach(async () => {
    await truncateAllTables(db);
    userRepository = new UserRepository(db);
  });

  it('should find a user by email when user exists', async () => {
    const createdUser = await createTestUser(db, {
      primaryEmail: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
    });

    const foundUser = await userRepository.findByEmail('john.doe@example.com');

    expect(foundUser).not.toBeNull();
    expect(foundUser?.id).toBe(createdUser.id);
    expect(foundUser?.primaryEmail).toBe('john.doe@example.com');
  });

  it('should return null when finding user by non-existent email', async () => {
    const foundUser = await userRepository.findByEmail('nonexistent@example.com');

    expect(foundUser).toBeNull();
  });

  it('should create user with email auth and save password hash', async () => {
    const newUser = await userRepository.createWithEmailAuth(
      {
        firstName: 'Jane',
        lastName: 'Smith',
        primaryEmail: 'jane.smith@example.com',
      },
      'hashed_password_123',
    );

    expect(newUser).toBeDefined();
    expect(newUser.primaryEmail).toBe('jane.smith@example.com');

    const savedPassword = await userRepository.findUserPassword(newUser.id);
    expect(savedPassword).toBe('hashed_password_123');
  });
});
