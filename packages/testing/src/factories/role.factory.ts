import { randomUUID } from 'node:crypto';
import { businessRoles, type Database, db as defaultDb } from '@salon/database';
import { createTestBusiness } from './business.factory.js';

export interface TestRoleOverrides {
  id?: string;
  businessId?: string;
  name?: string;
  description?: string;
  isSystem?: boolean;
}

export async function createTestRole(
  dbClient: Database = defaultDb,
  overrides: TestRoleOverrides = {},
) {
  const uniqueId = randomUUID().substring(0, 8);

  let businessId = overrides.businessId;
  if (!businessId) {
    const parentBusiness = await createTestBusiness(dbClient);
    businessId = parentBusiness.id;
  }

  const [insertedRole] = await dbClient
    .insert(businessRoles)
    .values({
      id: overrides.id || randomUUID(),
      businessId,
      name: overrides.name || `Test Role ${uniqueId}`,
      description: overrides.description || 'Test role description',
      isSystem: overrides.isSystem ?? false,
    })
    .returning();

  if (!insertedRole) {
    throw new Error('Failed to create test role record.');
  }

  return insertedRole;
}
