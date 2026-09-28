import { branches, businesses, type db } from '@salon/database';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type {
  IMarketplaceQueryService,
  PublicBusinessProfileDto,
} from '../../application/ports/marketplace-query.port.js';

export class MarketplaceQueryService implements IMarketplaceQueryService {
  constructor(private readonly database: typeof db) {}

  async getBusinessProfileBySlug(slug: string): Promise<PublicBusinessProfileDto | null> {
    // 1. Fetch the business ONLY IF it is active and published
    const businessRow = await this.database.query.businesses.findFirst({
      where: and(
        eq(businesses.slug, slug),
        eq(businesses.status, 'active'),
        eq(businesses.isPublished, true),
      ),
    });

    if (!businessRow) return null;

    // 2. Fetch the branches for this business ONLY IF they are active and published
    const branchesRows = await this.database.query.branches.findMany({
      where: and(
        eq(branches.businessId, businessRow.id),
        eq(branches.status, 'active'),
        eq(branches.isPublished, true),
      ),
    });

    // 3. Map directly to the Read Model (DTO) - No Domain Entities!
    return {
      id: businessRow.id,
      slug: businessRow.slug,
      name: businessRow.name,
      description: businessRow.description,
      socialLinks: businessRow.socialLinks as Record<string, string> | null,
      branches: branchesRows.map((b) => ({
        id: b.id,
        name: b.name,
        addressLine1: b.addressLine1,
        addressLine2: b.addressLine2,
        city: b.city,
        state: b.state,
        postalCode: b.postalCode,
        countryCode: b.countryCode,
        latitude: b.latitude,
        longitude: b.longitude,
        timezone: b.timezone,
        currency: b.currency,
      })),
    };
  }

  async listBusinesses(
    limit: number,
    offset: number,
  ): Promise<{ items: PublicBusinessProfileDto[]; total: number }> {
    // 1. Get total count
    const [countResult] = await this.database
      .select({ count: sql<number>`cast(count(${businesses.id}) as integer)` })
      .from(businesses)
      .where(and(eq(businesses.status, 'active'), eq(businesses.isPublished, true)));

    const total = countResult?.count ?? 0;

    if (total === 0) {
      return { items: [], total: 0 };
    }

    // 2. Fetch the paginated businesses, with strict deterministic sorting
    const paginatedBusinesses = await this.database.query.businesses.findMany({
      where: and(eq(businesses.status, 'active'), eq(businesses.isPublished, true)),
      limit,
      offset,
      orderBy: [desc(businesses.createdAt), desc(businesses.id)],
    });

    const businessIds = paginatedBusinesses.map((b) => b.id);

    // 3. Fetch all branches for ONLY these businesses (solving N+1 problem)
    const branchesRows = await this.database.query.branches.findMany({
      where: and(
        inArray(branches.businessId, businessIds),
        eq(branches.status, 'active'),
        eq(branches.isPublished, true),
      ),
    });

    // 4. Map them together
    const items = paginatedBusinesses.map((businessRow) => {
      const businessBranches = branchesRows.filter((b) => b.businessId === businessRow.id);

      return {
        id: businessRow.id,
        slug: businessRow.slug,
        name: businessRow.name,
        description: businessRow.description,
        socialLinks: businessRow.socialLinks as Record<string, string> | null,
        branches: businessBranches.map((b) => ({
          id: b.id,
          name: b.name,
          addressLine1: b.addressLine1,
          addressLine2: b.addressLine2,
          city: b.city,
          state: b.state,
          postalCode: b.postalCode,
          countryCode: b.countryCode,
          latitude: b.latitude,
          longitude: b.longitude,
          timezone: b.timezone,
          currency: b.currency,
        })),
      };
    });

    return { items, total };
  }
}
