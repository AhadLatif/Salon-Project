import { randomUUID } from 'node:crypto';
import { businessMembers, type Database, db as defaultDb, staffMembers } from '@salon/database';
import { createTestBusiness } from './business.factory.js';
import { createTestRole } from './role.factory.js';
import { createTestUser } from './user.factory.js';

export interface TestBusinessMemberOverrides {
  id?: string;
  businessId?: string;
  userId?: string;
  roleId?: string;
}

/**
 * Creates a business member (linking a user to a business).
 */
export async function createTestBusinessMember(
  dbClient: Database = defaultDb,
  overrides: TestBusinessMemberOverrides = {},
) {
  let businessId = overrides.businessId;
  if (!businessId) {
    const biz = await createTestBusiness(dbClient);
    businessId = biz.id;
  }

  let userId = overrides.userId;
  if (!userId) {
    const user = await createTestUser(dbClient);
    userId = user.id;
  }

  let roleId = overrides.roleId;
  if (!roleId) {
    const role = await createTestRole(dbClient, { businessId });
    roleId = role.id;
  }

  const [insertedMember] = await dbClient
    .insert(businessMembers)
    .values({
      id: overrides.id || randomUUID(),
      businessId,
      userId,
      roleId,
    })
    .returning();

  if (!insertedMember) {
    throw new Error('Failed to create test business member record.');
  }

  return insertedMember;
}

export interface TestStaffMemberOverrides {
  id?: string;
  businessId: string;
  businessMemberId?: string; // If omitted, creates a new business member automatically
  displayName?: string;
  jobTitle?: string;
  employmentType?: 'full_time' | 'part_time' | 'contractor';
  status?: 'active' | 'inactive' | 'terminated';
  excludeFromAutoAssignment?: boolean;
}

/**
 * Creates and inserts a test staff member record into the database.
 */
export async function createTestStaffMember(
  dbClient: Database = defaultDb,
  overrides: TestStaffMemberOverrides,
) {
  const uniqueId = randomUUID().substring(0, 8);

  let businessMemberId = overrides.businessMemberId;
  if (!businessMemberId) {
    const member = await createTestBusinessMember(dbClient, {
      businessId: overrides.businessId,
    });
    businessMemberId = member.id;
  }

  const [insertedStaff] = await dbClient
    .insert(staffMembers)
    .values({
      id: overrides.id || randomUUID(),
      businessId: overrides.businessId,
      businessMemberId,
      displayName: overrides.displayName || `Staff ${uniqueId}`,
      jobTitle: overrides.jobTitle || 'Stylist',
      employmentType: overrides.employmentType || 'full_time',
      status: overrides.status || 'active',
      excludeFromAutoAssignment: overrides.excludeFromAutoAssignment ?? false,
    })
    .returning();

  if (!insertedStaff) {
    throw new Error('Failed to create test staff member record.');
  }

  return insertedStaff;
}
