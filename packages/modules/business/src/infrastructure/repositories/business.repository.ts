import { businesses, businessMembers, businessRoles, type db } from '@salon/database';
import { OWNER_ROLE_NAME } from '@salon/shared';
import { and, eq, sql } from 'drizzle-orm';
import type {
  CreateBusinessWithOwnerData,
  IBusinessRepository,
  UpdateBusinessData,
} from '../../application/ports/business-repository.port.js';
import { BusinessEntity, type BusinessProps } from '../../domain/entities/business.entity.js';

export class BusinessRepository implements IBusinessRepository {
  constructor(private readonly database: typeof db) {}

  private async findOwnerUserId(businessId: string): Promise<string | null> {
    const [owner] = await this.database
      .select({ userId: businessMembers.userId })
      .from(businessMembers)
      .innerJoin(businessRoles, eq(businessMembers.roleId, businessRoles.id))
      .where(
        and(
          eq(businessMembers.businessId, businessId),
          eq(businessRoles.isSystem, true),
          eq(businessRoles.name, OWNER_ROLE_NAME),
        ),
      )
      .limit(1);

    return owner?.userId ?? null;
  }

  async findById(id: string): Promise<BusinessEntity | null> {
    const [row] = await this.database
      .select()
      .from(businesses)
      .where(eq(businesses.id, id))
      .limit(1);

    if (!row) return null;

    const ownerUserId = await this.findOwnerUserId(id);

    return new BusinessEntity({
      ...row,
      ownerUserId: ownerUserId ?? '',
    } as BusinessProps);
  }

  async findBySlug(slug: string): Promise<BusinessEntity | null> {
    const [row] = await this.database
      .select()
      .from(businesses)
      .where(eq(businesses.slug, slug))
      .limit(1);

    if (!row) return null;

    const ownerUserId = await this.findOwnerUserId(row.id);

    return new BusinessEntity({
      ...row,
      ownerUserId: ownerUserId ?? '',
    } as BusinessProps);
  }

  async getMembership(
    userId: string,
    businessId: string,
  ): Promise<{ memberId: string; roleId: string } | null> {
    const [member] = await this.database
      .select({
        memberId: businessMembers.id,
        roleId: businessMembers.roleId,
      })
      .from(businessMembers)
      .where(
        sql`${businessMembers.userId} = ${userId} AND ${businessMembers.businessId} = ${businessId}`,
      )
      .limit(1);

    if (!member) return null;

    return {
      memberId: member.memberId,
      roleId: member.roleId,
    };
  }

  async getUserBusinesses(userId: string): Promise<BusinessEntity[]> {
    const rows = await this.database
      .select({
        id: businesses.id,
        name: businesses.name,
        slug: businesses.slug,
        email: businesses.email,
        phoneNumber: businesses.phoneNumber,
        description: businesses.description,
        socialLinks: businesses.socialLinks,
        status: businesses.status,
        createdAt: businesses.createdAt,
        updatedAt: businesses.updatedAt,
        ownerUserId: businessMembers.userId,
      })
      .from(businessMembers)
      .innerJoin(businesses, eq(businessMembers.businessId, businesses.id))
      .where(eq(businessMembers.userId, userId));

    return rows.map(
      (r) =>
        new BusinessEntity({
          ...r,
          socialLinks: (r.socialLinks as Record<string, string>) ?? null,
        } as BusinessProps),
    );
  }

  async update(id: string, data: UpdateBusinessData): Promise<BusinessEntity | null> {
    const updatePayload: Record<string, unknown> = {};

    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.email !== undefined) updatePayload.email = data.email;
    if (data.phoneNumber !== undefined) updatePayload.phoneNumber = data.phoneNumber;
    if (data.socialLinks !== undefined) updatePayload.socialLinks = data.socialLinks;

    if (Object.keys(updatePayload).length === 0) {
      return this.findById(id);
    }

    const [updatedRow] = await this.database
      .update(businesses)
      .set(updatePayload)
      .where(eq(businesses.id, id))
      .returning();

    if (!updatedRow) return null;

    const ownerUserId = await this.findOwnerUserId(id);

    return new BusinessEntity({
      ...updatedRow,
      ownerUserId: ownerUserId ?? '',
    } as BusinessProps);
  }

  async createWithOwner(data: CreateBusinessWithOwnerData): Promise<BusinessEntity> {
    const createdBusiness = await this.database.transaction(async (tx) => {
      // 1. Create the Business record
      const [newBusiness] = await tx
        .insert(businesses)
        .values({
          name: data.business.name,
          slug: data.business.slug,
          email: data.business.email,
          phoneNumber: data.business.phoneNumber,
          description: data.business.description,
          socialLinks: data.business.socialLinks,
        })
        .returning();

      if (!newBusiness) {
        throw new Error('Failed to insert business entity into database.');
      }

      // 2. Create default 'Owner' role for this business
      const [newBusinessRole] = await tx
        .insert(businessRoles)
        .values({
          businessId: newBusiness.id,
          name: OWNER_ROLE_NAME,
          isSystem: true,
        })
        .returning();

      if (!newBusinessRole) {
        throw new Error('Failed to create Owner role.');
      }

      // 3. Link the user as a member of the business with the Owner role
      const [businessMember] = await tx
        .insert(businessMembers)
        .values({
          businessId: newBusiness.id,
          userId: data.ownerUserId,
          roleId: newBusinessRole.id,
        })
        .returning();

      if (!businessMember) {
        throw new Error('Failed to link business owner.');
      }

      return newBusiness;
    });

    return new BusinessEntity({
      ...createdBusiness,
      ownerUserId: data.ownerUserId,
    } as BusinessProps);
  }
}
