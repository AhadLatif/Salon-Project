import { branches, db } from '@salon/database';
import { createTestBusiness, truncateAllTables } from '@salon/testing';
import { and, eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { BranchRepository } from '../src/infrastructure/repositories/branch.repository.js';

/** Reads the derived spatial copy exactly as stored — `POINT(longitude latitude)`. */
async function locationText(id: string): Promise<string | null> {
  const rows = await db
    .select({ wkt: sql<string | null>`ST_AsText(location)` })
    .from(branches)
    .where(eq(branches.id, id));
  return rows[0]?.wkt ?? null;
}

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

  // --- PostGIS write path (ADR-017 §5.5) -------------------------------------

  const baseHours = [
    {
      dayOfWeek: 1,
      isClosed: false,
      opensAt: '09:00',
      closesAt: '17:00',
      shiftName: null,
    },
  ];

  it('derives the geography location on create, with longitude as the x axis', async () => {
    const business = await createTestBusiness(db);
    const branch = await repository.create({
      businessId: business.id,
      name: 'Geo Branch',
      timezone: 'America/New_York',
      currency: 'USD',
      addressLine1: '123 Main St',
      city: 'New York',
      countryCode: 'US',
      latitude: '40.7128',
      longitude: '-74.0060',
      openingHours: baseHours,
    });

    // POINT(x y) must be POINT(longitude latitude) — order pinned by the exact string.
    expect(await locationText(branch.id)).toBe('POINT(-74.006 40.7128)');

    // The derived copy must NOT leak into the domain entity (DECISION-008).
    expect('location' in branch).toBe(false);

    // The repository-written point answers a radius question correctly.
    const rows = await db.execute(sql`
      SELECT ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint(-74.0060, 40.7200), 4326)::geography,
        2000
      ) AS near
      FROM branches WHERE id = ${branch.id}`);
    const row = rows.rows[0] as { near: boolean };
    expect(row.near).toBe(true);
  });

  it('keeps location NULL when coordinates are missing', async () => {
    const business = await createTestBusiness(db);
    const branch = await repository.create({
      businessId: business.id,
      name: 'No-Geo Branch',
      timezone: 'UTC',
      currency: 'USD',
      addressLine1: '1 Main St',
      city: 'New York',
      countryCode: 'US',
      openingHours: baseHours,
    });

    expect(await locationText(branch.id)).toBeNull();
  });

  it('recomputes location from the merged coordinate pair on coordinate updates', async () => {
    const business = await createTestBusiness(db);
    const branch = await repository.create({
      businessId: business.id,
      name: 'Moving Branch',
      timezone: 'UTC',
      currency: 'USD',
      addressLine1: '1 Main St',
      city: 'New York',
      countryCode: 'US',
      latitude: '40.0000',
      longitude: '-74.0000',
      openingHours: baseHours,
    });
    expect(await locationText(branch.id)).toBe('POINT(-74 40)');

    // Partial update: only latitude changes; the pair is re-merged with the existing longitude.
    await repository.update(business.id, branch.id, { latitude: '40.8000' });
    expect(await locationText(branch.id)).toBe('POINT(-74 40.8)');

    // Clearing both coordinates clears the spatial copy.
    await repository.update(business.id, branch.id, { latitude: null, longitude: null });
    expect(await locationText(branch.id)).toBeNull();

    // An unrelated edit must not touch the location column at all (still NULL).
    await repository.update(business.id, branch.id, { name: 'Renamed' });
    expect(await locationText(branch.id)).toBeNull();
  });
});
