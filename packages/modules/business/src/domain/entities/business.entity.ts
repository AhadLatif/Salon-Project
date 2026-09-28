/**
 * Persisted shape of a business tenant.
 *
 * CONTRACT — `BusinessProps` maps 1:1 onto the columns of the `businesses` table
 * (`packages/infrastructure/database/src/schema/business/businesses.ts`).
 *
 * WHY THIS RULE EXISTS: this interface used to carry an `ownerUserId` that is **not a column**.
 * It was synthesised by the repository with a SECOND query (a join over `business_members` +
 * `business_roles`) on every read — including `findById`, which the tenant middleware calls on
 * every tenant-scoped request — and `getUserBusinesses` filled it with the **caller's** id rather
 * than the owner's, so the field silently lied about who owned the business. No code path ever
 * read it; it was pure cost plus a latent authorization hazard.
 *
 * INVARIANT: every property here must be assignable directly from a `businesses` row — no lookups,
 * no derivation, no joins. Data that cannot satisfy that belongs in an explicitly named query
 * method (see `IBusinessRepository.getOwnerUserId`), never in a props interface that claims to
 * describe a row.
 */
export interface BusinessProps {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  email: string;
  phoneNumber: string;
  status: 'pending' | 'active' | 'suspended' | 'archived';
  socialLinks?: Record<string, string> | null;
  verifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class BusinessEntity {
  constructor(private readonly props: BusinessProps) {}

  get id(): string {
    return this.props.id;
  }
  get slug(): string {
    return this.props.slug;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string | null | undefined {
    return this.props.description;
  }
  get email(): string {
    return this.props.email;
  }
  get phoneNumber(): string {
    return this.props.phoneNumber;
  }
  get status(): 'pending' | 'active' | 'suspended' | 'archived' {
    return this.props.status;
  }
  get socialLinks(): Record<string, string> | null | undefined {
    return this.props.socialLinks;
  }
  get verifiedAt(): Date | null | undefined {
    return this.props.verifiedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toPrimitives(): BusinessProps {
    return { ...this.props };
  }
}
