import { customerTagAssignments, customerTags, type Database } from '@salon/database';
import { handleUniqueConstraint } from '@salon/shared';
import { and, eq, sql } from 'drizzle-orm';
import type {
  CreateCustomerTagData,
  ICustomerTagRepository,
} from '../../application/ports/customer-repository.port.js';
import type {
  CustomerTagAssignmentEntity,
  CustomerTagEntity,
} from '../../domain/entities/customer-tag.entity.js';

export class CustomerTagRepository implements ICustomerTagRepository {
  constructor(private readonly db: Database) {}

  /**
   * Creates a new business tag definition.
   */
  async create(data: CreateCustomerTagData): Promise<CustomerTagEntity> {
    try {
      const [inserted] = await this.db
        .insert(customerTags)
        .values({
          businessId: data.businessId,
          name: data.name.trim(),
          color: data.color ? data.color.trim().toUpperCase() : null,
          description: data.description ? data.description.trim() : null,
        })
        .returning();

      return inserted as CustomerTagEntity;
    } catch (error: unknown) {
      // Race-condition guard: a concurrent create can violate the unique
      // (businessId, lower(name)) index between the use-case's read-before-write
      // check and the flush.
      handleUniqueConstraint(error, {
        uq_customer_tags_business_name:
          'A customer tag with this name already exists in this salon business',
      });
    }
  }

  /**
   * Finds a tag by ID strictly within the business tenant boundary.
   */
  async findById(businessId: string, tagId: string): Promise<CustomerTagEntity | null> {
    const [tag] = await this.db
      .select()
      .from(customerTags)
      .where(and(eq(customerTags.businessId, businessId), eq(customerTags.id, tagId)))
      .limit(1);

    return (tag as CustomerTagEntity) ?? null;
  }

  /**
   * Finds a tag by name (case-insensitive) within the business.
   */
  async findByName(businessId: string, name: string): Promise<CustomerTagEntity | null> {
    const normalized = name.trim().toLowerCase();
    const [tag] = await this.db
      .select()
      .from(customerTags)
      .where(
        and(
          eq(customerTags.businessId, businessId),
          sql`lower(${customerTags.name}) = ${normalized}`,
        ),
      )
      .limit(1);

    return (tag as CustomerTagEntity) ?? null;
  }

  /**
   * Lists all tag definitions for the business.
   */
  async findAll(businessId: string): Promise<CustomerTagEntity[]> {
    const tags = await this.db
      .select()
      .from(customerTags)
      .where(eq(customerTags.businessId, businessId))
      .orderBy(customerTags.name);

    return tags as CustomerTagEntity[];
  }

  /**
   * Deletes a tag definition. The DB FK constraint on customer_tag_assignments
   * automatically cascades and removes all customer assignments for this tag.
   */
  async delete(businessId: string, tagId: string): Promise<boolean> {
    const [deleted] = await this.db
      .delete(customerTags)
      .where(and(eq(customerTags.businessId, businessId), eq(customerTags.id, tagId)))
      .returning({ id: customerTags.id });

    return !!deleted;
  }

  /**
   * Idempotently assigns a tag to a customer profile.
   * If already assigned, onConflictDoNothing prevents duplicate failures.
   *
   * RACE-CONDITION GUARD: When the insert hits a conflict (row already exists),
   * we fall back to selecting the existing row. A concurrent unassignment can
   * delete that row between the conflict and the fallback select, which would
   * otherwise return `undefined` and violate the CustomerTagAssignmentEntity
   * contract. We retry the whole insert-or-select loop until we get a row or
   * the assignment genuinely settles.
   */
  async assignTag(
    businessId: string,
    customerId: string,
    tagId: string,
    assignedBy?: string | null,
  ): Promise<CustomerTagAssignmentEntity> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const [inserted] = await this.db
        .insert(customerTagAssignments)
        .values({
          businessId,
          businessCustomerId: customerId,
          customerTagId: tagId,
          assignedBy: assignedBy ?? null,
        })
        .onConflictDoNothing({
          target: [customerTagAssignments.businessCustomerId, customerTagAssignments.customerTagId],
        })
        .returning();

      if (inserted) {
        return inserted as CustomerTagAssignmentEntity;
      }

      // Conflict was skipped: the row already exists (or was just deleted by a
      // concurrent unassignment). Select the existing assignment; if it is gone,
      // loop again so the INSERT re-creates it atomically.
      const [existing] = await this.db
        .select()
        .from(customerTagAssignments)
        .where(
          and(
            eq(customerTagAssignments.businessId, businessId),
            eq(customerTagAssignments.businessCustomerId, customerId),
            eq(customerTagAssignments.customerTagId, tagId),
          ),
        )
        .limit(1);

      if (existing) {
        return existing as CustomerTagAssignmentEntity;
      }
    }

    // The assignment kept racing with unassignments — this is an internal
    // invariant failure (DB state oscillating), not a client problem.
    throw new Error(
      'Concurrent modification detected: customer tag assignment state kept changing',
    );
  }

  /**
   * Removes a tag assignment from a customer profile.
   */
  async unassignTag(businessId: string, customerId: string, tagId: string): Promise<boolean> {
    const [deleted] = await this.db
      .delete(customerTagAssignments)
      .where(
        and(
          eq(customerTagAssignments.businessId, businessId),
          eq(customerTagAssignments.businessCustomerId, customerId),
          eq(customerTagAssignments.customerTagId, tagId),
        ),
      )
      .returning({ customerTagId: customerTagAssignments.customerTagId });

    return !!deleted;
  }

  /**
   * Lists all tags currently assigned to a customer.
   */
  async findCustomerTags(businessId: string, customerId: string): Promise<CustomerTagEntity[]> {
    const tags = await this.db
      .select({
        id: customerTags.id,
        businessId: customerTags.businessId,
        name: customerTags.name,
        color: customerTags.color,
        description: customerTags.description,
        createdAt: customerTags.createdAt,
        updatedAt: customerTags.updatedAt,
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

    return tags as CustomerTagEntity[];
  }
}
