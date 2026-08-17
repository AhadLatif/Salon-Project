import { randomUUID } from 'node:crypto';
import { branches, type Database, db as defaultDb } from '@salon/database';

export interface TestBranchOverrides {
  id?: string;
  businessId: string;
  name?: string;
  phoneNumber?: string | null;
  email?: string | null;
  timezone?: string;
  currency?: string;
  addressLine1?: string;
  city?: string;
  countryCode?: string;
  status?: 'active' | 'inactive' | 'archived';
}

/**
 * Creates and inserts a test branch record into the database.
 */
export async function createTestBranch(
  dbClient: Database = defaultDb,
  overrides: TestBranchOverrides,
) {
  const uniqueId = randomUUID().substring(0, 8);

  const [insertedBranch] = await dbClient
    .insert(branches)
    .values({
      id: overrides.id || randomUUID(),
      businessId: overrides.businessId,
      name: overrides.name || `Branch ${uniqueId}`,
      timezone: overrides.timezone || 'UTC',
      currency: overrides.currency || 'USD',
      addressLine1: overrides.addressLine1 || '123 Main St',
      city: overrides.city || 'Test City',
      countryCode: overrides.countryCode || 'US',
      status: overrides.status || 'active',
      phoneNumber: overrides.phoneNumber || null,
      email: overrides.email || null,
    })
    .returning();

  if (!insertedBranch) {
    throw new Error('Failed to create test branch record.');
  }

  return insertedBranch;
}
