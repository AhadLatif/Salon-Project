import type { BusinessEntity } from '../../domain/entities/business.entity.js';

export interface CreateBusinessWithOwnerData {
  ownerUserId: string;
  business: {
    name: string;
    slug: string;
    email: string;
    phoneNumber: string;
    description?: string | null;
    socialLinks?: Record<string, string> | null;
  };
}

export interface UpdateBusinessData {
  name?: string | undefined;
  description?: string | null | undefined;
  email?: string | undefined;
  phoneNumber?: string | undefined;
  socialLinks?: Record<string, string> | null | undefined;
}

export interface IBusinessRepository {
  findById(id: string): Promise<BusinessEntity | null>;

  findBySlug(slug: string): Promise<BusinessEntity | null>;

  /**
   * Tenant existence probe for cross-module validators.
   *
   * Answers "does this business exist", NOT "is this business usable" — see the implementation for
   * why that distinction is deliberate rather than an oversight.
   */
  exists(id: string): Promise<boolean>;

  /**
   * The user id holding the system `Owner` role, or `null` when the tenant has no owner member.
   *
   * Deliberately kept OUT of `BusinessEntity`: ownership is derived from `business_members` +
   * `business_roles`, so resolving it costs an extra join. As an entity prop it taxed every read
   * (including the tenant middleware's `findById`); as an explicit method, callers pay on demand.
   */
  getOwnerUserId(businessId: string): Promise<string | null>;

  getMembership(
    userId: string,
    businessId: string,
  ): Promise<{ memberId: string; roleId: string } | null>;

  getUserBusinesses(userId: string): Promise<BusinessEntity[]>;

  createWithOwner(data: CreateBusinessWithOwnerData): Promise<BusinessEntity>;

  update(id: string, data: UpdateBusinessData): Promise<BusinessEntity | null>;

  isBusinessMemberInBusiness(businessId: string, businessMemberId: string): Promise<boolean>;
}
