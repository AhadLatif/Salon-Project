import {
  businessCustomers,
  customerTagAssignments,
  customerTags,
  type Database,
} from '@salon/database';
import { handleUniqueConstraint } from '@salon/shared';
import { and, count, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type {
  CreateCustomerData,
  GetCustomersFilter,
  ICustomerRepository,
  PaginatedCustomers,
  UpdateCustomerData,
} from '../../application/ports/customer-repository.port.js';
import type {
  BusinessCustomerEntity,
  CustomerWithTagsEntity,
} from '../../domain/entities/customer.entity.js';

export class CustomerRepository implements ICustomerRepository {
  constructor(private readonly db: Database) {}

  /**
   * Creates a new customer profile under the specified salon tenant.
   * Case-normalizes email to maintain invariant uniqueness per business.
   */
  async create(data: CreateCustomerData): Promise<BusinessCustomerEntity> {
    try {
      const [inserted] = await this.db
        .insert(businessCustomers)
        .values({
          businessId: data.businessId,
          userId: data.userId ?? null,
          firstName: data.firstName.trim(),
          lastName: data.lastName ? data.lastName.trim() : null,
          phoneNumber: data.phoneNumber ? data.phoneNumber.trim() : null,
          email: data.email ? data.email.trim().toLowerCase() : null,
          gender: data.gender ?? 'prefer_not_to_say',
          dateOfBirth: data.dateOfBirth ?? null,
          marketingOptIn: data.marketingOptIn ?? false,
        })
        .returning();

      return inserted as BusinessCustomerEntity;
    } catch (error: unknown) {
      // Race-condition guard: a concurrent insert can violate the unique email
      // index between the use-case's read-before-write check and the flush.
      handleUniqueConstraint(error, {
        uq_bus_customers_email:
          'A customer with this email address already exists in this salon directory',
      });
    }
  }

  /**
   * Retrieves a single customer profile strictly scoped to the tenant.
   */
  async findById(businessId: string, customerId: string): Promise<BusinessCustomerEntity | null> {
    const [customer] = await this.db
      .select()
      .from(businessCustomers)
      .where(
        and(eq(businessCustomers.businessId, businessId), eq(businessCustomers.id, customerId)),
      )
      .limit(1);

    return (customer as BusinessCustomerEntity) ?? null;
  }

  /**
   * Retrieves customer details including assigned tags for the CRM card view.
   */
  async findDetailsById(
    businessId: string,
    customerId: string,
  ): Promise<CustomerWithTagsEntity | null> {
    const [customer] = await this.db
      .select()
      .from(businessCustomers)
      .where(
        and(eq(businessCustomers.businessId, businessId), eq(businessCustomers.id, customerId)),
      )
      .limit(1);

    if (!customer) {
      return null;
    }

    const tags = await this.db
      .select({
        id: customerTags.id,
        name: customerTags.name,
        color: customerTags.color,
        description: customerTags.description,
        assignedAt: customerTagAssignments.assignedAt,
      })
      .from(customerTagAssignments)
      .innerJoin(
        customerTags,
        and(
          eq(customerTagAssignments.customerTagId, customerTags.id),
          eq(customerTagAssignments.businessId, customerTags.businessId),
        ),
      )
      .where(
        and(
          eq(customerTagAssignments.businessId, businessId),
          eq(customerTagAssignments.businessCustomerId, customerId),
        ),
      );

    return {
      ...(customer as BusinessCustomerEntity),
      tags,
    };
  }

  /**
   * Finds a customer by email (case-insensitive) within a specific business.
   */
  async findByEmail(businessId: string, email: string): Promise<BusinessCustomerEntity | null> {
    const normalized = email.trim().toLowerCase();
    const [customer] = await this.db
      .select()
      .from(businessCustomers)
      .where(
        and(
          eq(businessCustomers.businessId, businessId),
          sql`lower(${businessCustomers.email}) = ${normalized}`,
        ),
      )
      .limit(1);

    return (customer as BusinessCustomerEntity) ?? null;
  }

  /**
   * Finds a customer by phone number or email within a specific business.
   */
  async findByPhoneOrEmail(
    businessId: string,
    criteria: { phoneNumber?: string; email?: string },
  ): Promise<BusinessCustomerEntity | null> {
    const conditions = [];
    if (criteria.phoneNumber) {
      conditions.push(eq(businessCustomers.phoneNumber, criteria.phoneNumber.trim()));
    }
    if (criteria.email) {
      const normalized = criteria.email.trim().toLowerCase();
      conditions.push(sql`lower(${businessCustomers.email}) = ${normalized}`);
    }

    if (conditions.length === 0) {
      return null;
    }

    const [customer] = await this.db
      .select()
      .from(businessCustomers)
      .where(and(eq(businessCustomers.businessId, businessId), or(...conditions)))
      .limit(1);

    return (customer as BusinessCustomerEntity) ?? null;
  }

  /**
   * Finds a customer profile linked to a global B2C User ID.
   */
  async findByUserId(businessId: string, userId: string): Promise<BusinessCustomerEntity | null> {
    const [customer] = await this.db
      .select()
      .from(businessCustomers)
      .where(
        and(eq(businessCustomers.businessId, businessId), eq(businessCustomers.userId, userId)),
      )
      .limit(1);

    return (customer as BusinessCustomerEntity) ?? null;
  }

  /**
   * Atomically links an unlinked (walk-in/guest) customer profile to a B2C user.
   * Compare-and-swap: the UPDATE asserts `user_id IS NULL` so a concurrent claim
   * by another user cannot silently hijack the profile. Returns null when the
   * CAS fails (profile already owned or deleted).
   */
  async claimForUser(
    businessId: string,
    customerId: string,
    userId: string,
  ): Promise<BusinessCustomerEntity | null> {
    const [claimed] = await this.db
      .update(businessCustomers)
      .set({ userId, updatedAt: new Date() })
      .where(
        and(
          eq(businessCustomers.businessId, businessId),
          eq(businessCustomers.id, customerId),
          isNull(businessCustomers.userId),
        ),
      )
      .returning();

    return (claimed as BusinessCustomerEntity) ?? null;
  }

  /**
   * Searches and lists customers with pagination, status, and tag filtering.
   */
  async findAll(businessId: string, filter: GetCustomersFilter = {}): Promise<PaginatedCustomers> {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions = [eq(businessCustomers.businessId, businessId)];

    if (filter.status) {
      conditions.push(eq(businessCustomers.status, filter.status));
    }

    if (filter.search && filter.search.trim().length > 0) {
      const term = `%${filter.search.trim()}%`;
      const searchCondition = or(
        ilike(businessCustomers.firstName, term),
        ilike(businessCustomers.lastName, term),
        ilike(businessCustomers.email, term),
        ilike(businessCustomers.phoneNumber, term),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    if (filter.tagId) {
      // Subquery to filter customers assigned to the given tag within the business
      const taggedCustomerIds = this.db
        .select({ id: customerTagAssignments.businessCustomerId })
        .from(customerTagAssignments)
        .where(
          and(
            eq(customerTagAssignments.businessId, businessId),
            eq(customerTagAssignments.customerTagId, filter.tagId),
          ),
        );

      conditions.push(sql`${businessCustomers.id} IN (${taggedCustomerIds})`);
    }

    const whereClause = and(...conditions);

    const [totalResult] = await this.db
      .select({ count: count() })
      .from(businessCustomers)
      .where(whereClause);

    const total = totalResult ? Number(totalResult.count) : 0;

    const customers = await this.db
      .select()
      .from(businessCustomers)
      .where(whereClause)
      .orderBy(desc(businessCustomers.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      customers: customers as BusinessCustomerEntity[],
      total,
    };
  }

  /**
   * Updates mutable profile details for a customer.
   */
  async update(
    businessId: string,
    customerId: string,
    data: UpdateCustomerData,
  ): Promise<BusinessCustomerEntity | null> {
    const values: Partial<typeof businessCustomers.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.firstName !== undefined) values.firstName = data.firstName.trim();
    if (data.lastName !== undefined) values.lastName = data.lastName ? data.lastName.trim() : null;
    if (data.phoneNumber !== undefined)
      values.phoneNumber = data.phoneNumber ? data.phoneNumber.trim() : null;
    if (data.email !== undefined)
      values.email = data.email ? data.email.trim().toLowerCase() : null;
    if (data.gender !== undefined) values.gender = data.gender;
    if (data.dateOfBirth !== undefined) values.dateOfBirth = data.dateOfBirth;
    if (data.marketingOptIn !== undefined) values.marketingOptIn = data.marketingOptIn;
    // userId is mutable only via the GetOrCreateCustomerForUserUseCase claiming flow;
    // it is intentionally absent from the public UpdateCustomerDto.
    if (data.userId !== undefined) values.userId = data.userId;

    try {
      const [updated] = await this.db
        .update(businessCustomers)
        .set(values)
        .where(
          and(eq(businessCustomers.businessId, businessId), eq(businessCustomers.id, customerId)),
        )
        .returning();

      return (updated as BusinessCustomerEntity) ?? null;
    } catch (error: unknown) {
      // Race-condition guard: a concurrent rename to an existing email can now
      // trip the unique index even though the use-case pre-checked.
      handleUniqueConstraint(error, {
        uq_bus_customers_email:
          'A customer with this email address already exists in this salon directory',
      });
    }
  }

  /**
   * Soft-archives a customer profile by setting status to 'archived'.
   */
  async archive(businessId: string, customerId: string): Promise<BusinessCustomerEntity | null> {
    const [archived] = await this.db
      .update(businessCustomers)
      .set({
        status: 'archived',
        updatedAt: new Date(),
      })
      .where(
        and(eq(businessCustomers.businessId, businessId), eq(businessCustomers.id, customerId)),
      )
      .returning();

    return (archived as BusinessCustomerEntity) ?? null;
  }
}
