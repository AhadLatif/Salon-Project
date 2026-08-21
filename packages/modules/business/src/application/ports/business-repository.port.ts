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
  getMembership(
    userId: string,
    businessId: string,
  ): Promise<{ memberId: string; roleId: string } | null>;
  getUserBusinesses(userId: string): Promise<BusinessEntity[]>;
  createWithOwner(data: CreateBusinessWithOwnerData): Promise<BusinessEntity>;
  update(id: string, data: UpdateBusinessData): Promise<BusinessEntity | null>;
  isBusinessMemberInBusiness(businessId: string, businessMemberId: string): Promise<boolean>;
}
