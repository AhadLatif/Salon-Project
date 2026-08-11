import { randomUUID } from 'node:crypto';
import { businesses, type Database, db as defaultDb } from '@salon/database';

export interface TestBusinessOverrides {
  id?: string;
  slug?: string;
  name?: string;
  description?: string;
  email?: string;
  phoneNumber?: string;
  status?: 'pending' | 'active' | 'suspended' | 'archived';
}

/**
 * Creates and inserts a test business record into the database.
 */
export async function createTestBusiness(
  dbClient: Database = defaultDb,
  overrides: TestBusinessOverrides = {},
) {
  const uniqueId = randomUUID().substring(0, 8);
  const slug = overrides.slug || `salon-${uniqueId}`;

  const [insertedBusiness] = await dbClient
    .insert(businesses)
    .values({
      id: overrides.id || randomUUID(),
      slug,
      name: overrides.name || `Salon ${uniqueId}`,
      description: overrides.description || 'Test salon description',
      email: overrides.email || `contact@salon-${uniqueId}.com`,
      phoneNumber: overrides.phoneNumber || '+1234567890',
      status: overrides.status || 'active',
    })
    .returning();

  if (!insertedBusiness) {
    throw new Error('Failed to create test business record.');
  }

  return insertedBusiness;
}
