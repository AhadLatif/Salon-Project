import { branches, type db, openingHours } from '@salon/database';
import { and, eq, ne } from 'drizzle-orm';
import type {
  CreateBranchData,
  IBranchRepository,
  UpdateBranchData,
} from '../../application/ports/branch-repository.port.js';
import {
  BranchEntity,
  type BranchProps,
  type OpeningHourProps,
} from '../../domain/entities/branch.entity.js';

export class BranchRepository implements IBranchRepository {
  constructor(private readonly database: typeof db) {}

  /**
   * Transforms raw database rows into our rich Domain Entity.
   */
  private toDomainEntity(
    branchRow: typeof branches.$inferSelect,
    hoursRows: (typeof openingHours.$inferSelect)[] = [],
  ): BranchEntity {
    return new BranchEntity({
      ...branchRow,
      openingHours: hoursRows.map((h) => ({
        ...h,
        // Drizzle might return dates or strings for times depending on pg driver settings,
        // so we just pass them through safely.
      })),
    } as BranchProps);
  }

  async create(data: CreateBranchData): Promise<BranchEntity> {
    // We use a transaction because creating a branch without opening hours
    // is an invalid business state in our domain.
    return await this.database.transaction(async (tx) => {
      const dummyBranchId = '00000000-0000-0000-0000-000000000000';
      const hoursToInsert = data.openingHours.map((hours, index) => ({
        businessId: data.businessId,
        branchId: dummyBranchId,
        dayOfWeek: hours.dayOfWeek,
        shiftName: hours.shiftName ?? null,
        isClosed: hours.isClosed,
        opensAt: hours.opensAt ?? null,
        closesAt: hours.closesAt ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        id: `00000000-0000-0000-0000-00000000000${index}`,
      }));

      // Validate business rules BEFORE inserting into database
      this.toDomainEntity(
        {
          id: dummyBranchId,
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
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        hoursToInsert,
      );

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
      // 1. Fetch existing branch and hours
      const existingBranch = await tx.query.branches.findFirst({
        where: and(eq(branches.id, branchId), eq(branches.businessId, businessId)),
      });

      if (!existingBranch) return null;

      const hoursRows = await tx.query.openingHours.findMany({
        where: and(eq(openingHours.branchId, branchId), eq(openingHours.businessId, businessId)),
        orderBy: (hours, { asc }) => [asc(hours.dayOfWeek)],
      });

      // 2. Construct candidate state and run domain validation BEFORE write
      const candidateData = { ...existingBranch };
      for (const key in data) {
        if ((data as Record<string, unknown>)[key] !== undefined) {
          (candidateData as Record<string, unknown>)[key] = (data as Record<string, unknown>)[key];
        }
      }
      // This throws ValidationError if the candidate state is invalid
      this.toDomainEntity(candidateData, hoursRows);

      // 3. Apply update only after validation passes
      const [updatedBranch] = await tx
        .update(branches)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(and(eq(branches.id, branchId), eq(branches.businessId, businessId)))
        .returning();

      if (!updatedBranch) return null;

      return this.toDomainEntity(updatedBranch, hoursRows);
    });
  }

  async replaceOpeningHours(
    businessId: string,
    branchId: string,
    hoursData: Omit<OpeningHourProps, 'id' | 'businessId' | 'branchId'>[],
  ): Promise<BranchEntity | null> {
    return await this.database.transaction(async (tx) => {
      // 1. Verify branch exists and lock it for update to prevent concurrent modifications
      const [branch] = await tx
        .select()
        .from(branches)
        .where(and(eq(branches.id, branchId), eq(branches.businessId, businessId)))
        .for('update');

      if (!branch) return null;

      // 2. Delete old hours
      await tx
        .delete(openingHours)
        .where(and(eq(openingHours.branchId, branchId), eq(openingHours.businessId, businessId)));

      // 3. Insert new hours
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

    return !!deleted;
  }
}
