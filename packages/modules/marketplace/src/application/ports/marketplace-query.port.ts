export interface PublicBranchDto {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  countryCode: string;
  latitude: string | null;
  longitude: string | null;
  timezone: string;
  currency: string;
}

export interface PublicBusinessProfileDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  socialLinks: Record<string, string> | null;
  branches: PublicBranchDto[];
}

export interface IMarketplaceQueryService {
  /**
   * Returns a business by slug ONLY IF it is active and isPublished = true.
   * Includes all active, published branches.
   */
  getBusinessProfileBySlug(slug: string): Promise<PublicBusinessProfileDto | null>;

  /**
   * Returns a paginated list of all active, published businesses.
   * Enforces stable sorting (createdAt DESC, id DESC).
   */
  listBusinesses(
    limit: number,
    offset: number,
  ): Promise<{ items: PublicBusinessProfileDto[]; total: number }>;
}
