import { randomUUID } from 'node:crypto';
import { type Database, db as defaultDb, users } from '@salon/database';

export interface TestUserOverrides {
  id?: string;
  firstName?: string;
  lastName?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  status?: 'active' | 'suspended' | 'deleted';
}

/**
 * Creates and inserts a test user record into the database.
 */
export async function createTestUser(
  dbClient: Database = defaultDb,
  overrides: TestUserOverrides = {},
) {
  const uniqueId = randomUUID().substring(0, 8);
  const email = overrides.primaryEmail || `test.user.${uniqueId}@example.com`;

  const [insertedUser] = await dbClient
    .insert(users)
    .values({
      id: overrides.id || randomUUID(),
      firstName: overrides.firstName || 'Test',
      lastName: overrides.lastName || 'User',
      primaryEmail: email,
      primaryPhone: overrides.primaryPhone || '+1234567890',
      status: overrides.status || 'active',
    })
    .returning();

  if (!insertedUser) {
    throw new Error('Failed to create test user record.');
  }

  return insertedUser;
}
