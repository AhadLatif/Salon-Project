import { businesses, businessMembers, businessRoles, type db } from '@salon/database';
import { OWNER_ROLE_NAME } from '@salon/shared';
import { and, eq, getTableColumns, sql } from 'drizzle-orm';
import type {
  CreateBusinessWithOwnerData,
  IBusinessRepository,
  UpdateBusinessData,
} from '../../application/ports/business-repository.port.js';
import type { BusinessEntity } from '../../domain/entities/business.entity.js';

/** A full `businesses` row as Drizzle returns it — the ONLY shape the entity accepts. */
type BusinessRow = typeof businesses.$inferSelect;

/**
 * Normalises the `social_links` jsonb column into the `Record<string, string>` the API declares.
 *
 * `jsonb` surfaces as `unknown`, so this is the single deliberate narrowing point for that column.
 * Non-string values are dropped rather than asserted: a cast (`as Record<string, string>`) would
 * publish whatever a bad write put in the column, and this mapper is the boundary that stops it.
 */
function toSocialLinks(value: unknown): Record<string, string> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return null;

  const links: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') links[key] = entry;
  }

  return links;
}

/**
 * THE row → entity mapper for this module.
 *
 * WHY A FUNCTION INSTEAD OF `as BusinessProps`: the previous code spread a database row and cast
 * the result, five times. A cast is an unchecked promise to the compiler — when the schema and the
 * props interface drifted, it still compiled and the mismatch shipped silently (that is exactly how
 * `ownerUserId` survived). Here every field is named, so the next schema change is a COMPILE ERROR,
 * which is the entire point of having a domain type.
 *
 * NOTE: the entity is now a plain shape, so this function's job is only to NARROW `social_links`
 * (jsonb surfaces as `unknown`). It no longer constructs a class, which removes the second
 * row → props copy that used to precede serialization.
 */
function toBusinessEntity(row: BusinessRow): BusinessEntity {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    email: row.email,
    phoneNumber: row.phoneNumber,
    status: row.status,
    socialLinks: toSocialLinks(row.socialLinks),
    verifiedAt: row.verifiedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class BusinessRepository implements IBusinessRepository {
  constructor(private readonly database: typeof db) {}

  /**
   * Resolves the user id holding the system `Owner` role for a business.
   *
   * Deliberately a NAMED METHOD rather than a field on the entity: ownership is derived from
   * `business_members` + `business_roles`, so it costs an extra join. As a prop it forced that join
   * onto every read (including the tenant middleware's `findById`); as a method, callers pay only
   * when they genuinely need the owner.
   */
  async getOwnerUserId(businessId: string): Promise<string | null> {
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

    return row ? toBusinessEntity(row) : null;
  }

  async findBySlug(slug: string): Promise<BusinessEntity | null> {
    const [row] = await this.database
      .select()
      .from(businesses)
      .where(eq(businesses.slug, slug))
      .limit(1);

    return row ? toBusinessEntity(row) : null;
  }

  /**
   * Cheap existence probe used by cross-module validators.
   *
   * WHY NOT `findById(...) !== null`: `findById` selects the whole row, runs the owner join and
   * constructs a domain entity. Callers such as `add-favorite` only need a yes/no, so this asks the
   * database the actual question (`SELECT id ... LIMIT 1`) and stops there.
   *
   * SEMANTICS — deliberately "does this tenant exist", NOT "is this tenant usable". A business with
   * status `suspended` or `archived` still returns `true`; blocking those is a product rule that
   * must be decided and applied deliberately (see the active-only checks in
   * `CustomerQueryService.isCustomerInBusiness` and `BranchQueryService`), not smuggled in here.
   */
  async exists(id: string): Promise<boolean> {
    const [row] = await this.database
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.id, id))
      .limit(1);

    return row !== undefined;
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

  /**
   * Every business the given user is a member of.
   *
   * Selects ALL `businesses` columns (`getTableColumns`) so the one mapper applies and the result
   * carries exactly the same field set as `findById`. Previously this method hand-picked a subset
   * and silently omitted `verifiedAt` — so "a business" had two different shapes depending on which
   * method produced it — and it reported the CALLER's user id as `ownerUserId`, mislabelling every
   * business as owned by whoever happened to be asking.
   */
  async getUserBusinesses(userId: string): Promise<BusinessEntity[]> {
    const rows = await this.database
      .select(getTableColumns(businesses))
      .from(businessMembers)
      .innerJoin(businesses, eq(businessMembers.businessId, businesses.id))
      .where(eq(businessMembers.userId, userId));

    return rows.map((row) => toBusinessEntity(row));
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

    return toBusinessEntity(updatedRow);
  }

  /**
   * Bootstraps a new business tenant atomically inside a database transaction.
   *
   * Transaction Invariants:
   * 1. Inserts the `businesses` row.
   * 2. Inserts the system `Owner` role in `business_roles` (`isSystem: true`).
   * 3. Inserts the creator's record in `business_members` linked to the owner role.
   *
   * If any step fails (e.g. unique slug collision), the entire transaction rolls back,
   * guaranteeing no orphaned businesses or memberless tenants exist.
   */
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

    return toBusinessEntity(createdBusiness);
  }

  /**
   * Verifies that a business member ID exists and belongs to the given business workspace (tenant).
   * Used for cross-module validation (e.g. Staff onboarding) to protect against IDOR.
   */
  async isBusinessMemberInBusiness(businessId: string, businessMemberId: string): Promise<boolean> {
    const member = await this.database.query.businessMembers.findFirst({
      where: and(
        eq(businessMembers.id, businessMemberId),
        eq(businessMembers.businessId, businessId),
      ),
      columns: { id: true },
    });

    return Boolean(member);
  }
}
