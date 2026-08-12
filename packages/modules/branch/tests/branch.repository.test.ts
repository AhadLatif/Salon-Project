import { branches, db } from '@salon/database';
import { createTestBusiness, truncateAllTables } from '@salon/testing';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { BranchRepository } from '../src/infrastructure/repositories/branch.repository.js';

describe('BranchRepository Integration Tests', () => {
  let repository: BranchRepository;

  beforeEach(async () => {
    await truncateAllTables(db);
    repository = new BranchRepository(db);
  });

  it('should soft delete a branch correctly', async () => {
    const business = await createTestBusiness(db);

    const branch = await repository.create({
      businessId: business.id,
      name: 'Downtown Branch',
      timezone: 'America/New_York',
      currency: 'USD',
      addressLine1: '123 Main St',
      city: 'New York',
      countryCode: 'US',
      openingHours: [
        {
          dayOfWeek: 1,
          isClosed: false,
          opensAt: '09:00',
          closesAt: '17:00',
          shiftName: null,
        },
      ],
    });

    expect(branch).toBeDefined();
    const branchId = branch.id;
    expect(branchId).toBeDefined();

    await repository.delete(business.id, branchId as string);

    const dbBranch = await db
      .select()
      .from(branches)
      .where(and(eq(branches.id, branchId as string), eq(branches.businessId, business.id)))
      .limit(1)
      .then((rows) => rows[0]);

    expect(dbBranch).toBeDefined();
    expect(dbBranch?.status).toBe('archived');
  });

  it('should respect tenant boundaries', async () => {
    const businessA = await createTestBusiness(db);
    const businessB = await createTestBusiness(db, {
      name: 'Business B',
      slug: 'business-b',
    });

    const branchA = await repository.create({
      businessId: businessA.id,
      name: 'Branch A',
      timezone: 'America/New_York',
      currency: 'USD',
      addressLine1: '123 Main St',
      city: 'New York',
      countryCode: 'US',
      openingHours: [
        {
          dayOfWeek: 1,
          isClosed: false,
          opensAt: '09:00',
          closesAt: '17:00',
          shiftName: null,
        },
      ],
    });

    // Trying to get Branch A with Business B's context should return null
    const result = await repository.findById(businessB.id, branchA.id as string);
    expect(result).toBeNull();

    // Getting Branch A with Business A's context should succeed
    const validResult = await repository.findById(businessA.id, branchA.id as string);
    expect(validResult).not.toBeNull();
  });

  it('should exclude archived branches from findById and findAllByBusinessId', async () => {
    const business = await createTestBusiness(db);

    const branch = await repository.create({
      businessId: business.id,
      name: 'Downtown Branch',
      timezone: 'America/New_York',
      currency: 'USD',
      addressLine1: '123 Main St',
      city: 'New York',
      countryCode: 'US',
      openingHours: [
        {
          dayOfWeek: 1,
          isClosed: false,
          opensAt: '09:00',
          closesAt: '17:00',
          shiftName: null,
        },
      ],
    });

    // Soft delete the branch
    await repository.delete(business.id, branch.id as string);

    // Should not be found after deletion
    const deletedResult = await repository.findById(business.id, branch.id as string);
    expect(deletedResult).toBeNull();

    const allBranches = await repository.findAllByBusinessId(business.id);
    expect(allBranches).toHaveLength(0);
  });

  it('should return false when deleting an already archived branch', async () => {
    const business = await createTestBusiness(db);

    const branch = await repository.create({
      businessId: business.id,
      name: 'Downtown Branch',
      timezone: 'America/New_York',
      currency: 'USD',
      addressLine1: '123 Main St',
      city: 'New York',
      countryCode: 'US',
      openingHours: [
        {
          dayOfWeek: 1,
          isClosed: false,
          opensAt: '09:00',
          closesAt: '17:00',
          shiftName: null,
        },
      ],
    });

    // Delete twice
    const firstDelete = await repository.delete(business.id, branch.id as string);
    expect(firstDelete).toBe(true);

    const secondDelete = await repository.delete(business.id, branch.id as string);
    expect(secondDelete).toBe(false);
  });
});
