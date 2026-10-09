import { branches, type db, openingHours } from '@salon/database';
import { and, eq, ne, sql } from 'drizzle-orm';
import type {
  CreateBranchData,
  IBranchRepository,
  UpdateBranchData,
} from '../../application/ports/branch-repository.port.js';
import type { BranchEntity, OpeningHourProps } from '../../domain/entities/branch.entity.js';
import { assertValidBranch } from '../../domain/policies/branch.policy.js';

/**
 * Converts coordinates to PostGIS geography(Point, 4326) in (longitude, latitude) order.
 * Returns null if either coordinate is missing.
 */
function deriveLocation(latitude: string | null | undefined, longitude: string | null | undefined) {
  if (latitude == null || longitude == null) {
    return null;
  }
  return sql`ST_SetSRID(ST_MakePoint(${longitude}::float8, ${latitude}::float8), 4326)::geography`;
}

export class BranchRepository implements IBranchRepository {
  constructor(private readonly database: typeof db) {}

  /**
   * Assembles a BranchEntity from the branches table row and opening_hours rows.
   * Strips the internal spatial `location` column and validates domain invariants.
   */
  private toDomainEntity(
    branchRow: typeof branches.$inferSelect,
    hoursRows: (typeof openingHours.$inferSelect)[] = [],
  ): BranchEntity {
    // Spatial copy is persistence-internal and excluded from the domain entity (DECISION-008)
    const { location: _spatialCopy, ...row } = branchRow;
    const branch: BranchEntity = {
      ...row,
      openingHours: hoursRows.map((h) => ({
        ...h,
      })),
    };

    assertValidBranch(branch);

    return branch;
  }

  async create(data: CreateBranchData): Promise<BranchEntity> {
    return await this.database.transaction(async (tx) => {
      // Validate business rules before persisting
      assertValidBranch({
        businessId: data.businessId,
        name: data.name,
        countryCode: data.countryCode,
        currency: data.currency,
        openingHours: data.openingHours,
      });

      const [newBranch] = await tx
        .insert(branches)
        .values({
          businessId: data.businessId,
          name: data.name,
          phoneNumber: data.phoneNumber ?? null,
          email: data.email ?? null,
          timezone: data.timezone,
          currency: data.currency,
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2 ?? null,
          city: data.city,
          state: data.state ?? null,
          postalCode: data.postalCode ?? null,
          countryCode: data.countryCode,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          location: deriveLocation(data.latitude, data.longitude),
        })
        .returning();

      if (!newBranch) {
        throw new Error('Failed to insert branch record.');
      }

      const hoursForDb = data.openingHours.map((hours) => ({
        businessId: data.businessId,
        branchId: newBranch.id,
        dayOfWeek: hours.dayOfWeek,
        shiftName: hours.shiftName ?? null,
        isClosed: hours.isClosed,
        opensAt: hours.opensAt ?? null,
        closesAt: hours.closesAt ?? null,
      }));

      const newHours = await tx.insert(openingHours).values(hoursForDb).returning();

      return this.toDomainEntity(newBranch, newHours);
    });
  }

  async findById(businessId: string, branchId: string): Promise<BranchEntity | null> {
    const branchRow = await this.database.query.branches.findFirst({
      where: and(
        eq(branches.id, branchId),
        eq(branches.businessId, businessId),
        ne(branches.status, 'archived'),
      ),
    });

    if (!branchRow) return null;

    const hoursRows = await this.database.query.openingHours.findMany({
      where: and(eq(openingHours.branchId, branchId), eq(openingHours.businessId, businessId)),
      orderBy: (hours, { asc }) => [asc(hours.dayOfWeek)],
    });

    return this.toDomainEntity(branchRow, hoursRows);
  }

  async findAllByBusinessId(businessId: string): Promise<BranchEntity[]> {
    const allBranches = await this.database.query.branches.findMany({
      where: and(eq(branches.businessId, businessId), ne(branches.status, 'archived')),
      orderBy: (b, { desc }) => [desc(b.createdAt)],
    });

    // To prevent N+1 queries, we fetch all hours for the business in one go
    // and then group them in memory.
    const allHours = await this.database.query.openingHours.findMany({
      where: eq(openingHours.businessId, businessId),
      orderBy: (hours, { asc }) => [asc(hours.dayOfWeek)],
    });

    return allBranches.map((branch) => {
      const branchHours = allHours.filter((h) => h.branchId === branch.id);
      return this.toDomainEntity(branch, branchHours);
    });
  }

  async update(
    businessId: string,
    branchId: string,
    data: UpdateBranchData,
  ): Promise<BranchEntity | null> {
    return await this.database.transaction(async (tx) => {
      // Lock the branch row to prevent concurrent lost updates
      const [existingBranch] = await tx
        .select()
        .from(branches)
        .where(
          and(
            eq(branches.id, branchId),
            eq(branches.businessId, businessId),
            ne(branches.status, 'archived'),
          ),
        )
        .limit(1)
        .for('update');

      if (!existingBranch) return null;

      const hoursRows = await tx.query.openingHours.findMany({
        where: and(eq(openingHours.branchId, branchId), eq(openingHours.businessId, businessId)),
        orderBy: (hours, { asc }) => [asc(hours.dayOfWeek)],
      });

      // Merge and validate invariants against the candidate state
      const candidateData = { ...existingBranch };
      for (const key in data) {
        if ((data as Record<string, unknown>)[key] !== undefined) {
          (candidateData as Record<string, unknown>)[key] = (data as Record<string, unknown>)[key];
        }
      }
      this.toDomainEntity(candidateData, hoursRows);

      // Recompute PostGIS geography point if coordinates were touched
      const touchesCoordinates = data.latitude !== undefined || data.longitude !== undefined;
      const [updatedBranch] = await tx
        .update(branches)
        .set({
          ...data,
          ...(touchesCoordinates
            ? { location: deriveLocation(candidateData.latitude, candidateData.longitude) }
            : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(branches.id, branchId), eq(branches.businessId, businessId)))
        .returning();

      if (!updatedBranch) return null;

      return this.toDomainEntity(updatedBranch, hoursRows);
    });
  }

  /** Replaces opening hours for a branch atomically inside a transaction. */
  async replaceOpeningHours(
    businessId: string,
    branchId: string,
    hoursData: Omit<OpeningHourProps, 'id' | 'businessId' | 'branchId'>[],
  ): Promise<BranchEntity | null> {
    return await this.database.transaction(async (tx) => {
      const [branch] = await tx
        .select()
        .from(branches)
        .where(
          and(
            eq(branches.id, branchId),
            eq(branches.businessId, businessId),
            ne(branches.status, 'archived'),
          ),
        )
        .for('update');

      if (!branch) return null;

      await tx
        .delete(openingHours)
        .where(and(eq(openingHours.branchId, branchId), eq(openingHours.businessId, businessId)));

      const hoursToInsert = hoursData.map((hours) => ({
        businessId: businessId,
        branchId: branchId,
        dayOfWeek: hours.dayOfWeek,
        shiftName: hours.shiftName ?? null,
        isClosed: hours.isClosed,
        opensAt: hours.opensAt ?? null,
        closesAt: hours.closesAt ?? null,
      }));

      const newHours = await tx.insert(openingHours).values(hoursToInsert).returning();

      return this.toDomainEntity(branch, newHours);
    });
  }

  async delete(businessId: string, branchId: string): Promise<boolean> {
    const [deleted] = await this.database
      .update(branches)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(
        and(
          eq(branches.id, branchId),
          eq(branches.businessId, businessId),
          ne(branches.status, 'archived'),
        ),
      )
      .returning({ id: branches.id });

    return Boolean(deleted);
  }

  /**
   * Fast existence check: verifies that a branch exists, belongs to the specified business tenant,
   * and is not archived (soft-deleted). Used across modules to prevent cross-tenant IDOR attacks.
   */
  async isBranchInBusiness(businessId: string, branchId: string): Promise<boolean> {
    const branch = await this.database.query.branches.findFirst({
      where: and(
        eq(branches.id, branchId),
        eq(branches.businessId, businessId),
        ne(branches.status, 'archived'),
      ),
      columns: { id: true },
    });

    return Boolean(branch);
  }
}
