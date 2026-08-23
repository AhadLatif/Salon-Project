import { customerFavorites, type Database } from '@salon/database';
import { and, desc, eq } from 'drizzle-orm';
import type {
  CreateCustomerFavoriteData,
  ICustomerFavoriteRepository,
} from '../../application/ports/customer-repository.port.js';
import type { CustomerFavoriteEntity } from '../../domain/entities/customer-favorite.entity.js';

export class CustomerFavoriteRepository implements ICustomerFavoriteRepository {
  constructor(private readonly db: Database) {}

  /**
   * Adds a business or staff member to a user's favorites idempotently.
   */
  async create(data: CreateCustomerFavoriteData): Promise<CustomerFavoriteEntity> {
    const [inserted] = await this.db
      .insert(customerFavorites)
      .values({
        userId: data.userId,
        businessId: data.businessId ?? null,
        staffMemberId: data.staffMemberId ?? null,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted) {
      return inserted as CustomerFavoriteEntity;
    }

    // Race-safe fallback: a concurrent request already inserted the same
    // (userId, business|staff) favorite. Return the existing row so the API
    // responds idempotently instead of surfacing a 500 from the unique index.
    const existing = await this.findByTarget(data.userId, {
      businessId: data.businessId ?? null,
      staffMemberId: data.staffMemberId ?? null,
    });
    if (!existing) {
      throw new Error('Failed to create favorite record due to an unexpected conflict');
    }
    return existing;
  }

  /**
   * Finds a favorite record by ID for a specific user.
   */
  async findById(id: string, userId: string): Promise<CustomerFavoriteEntity | null> {
    const [favorite] = await this.db
      .select()
      .from(customerFavorites)
      .where(and(eq(customerFavorites.id, id), eq(customerFavorites.userId, userId)))
      .limit(1);

    return (favorite as CustomerFavoriteEntity) ?? null;
  }

  /**
   * Finds if a user has already favorited a specific target.
   */
  async findByTarget(
    userId: string,
    target: { businessId?: string | null; staffMemberId?: string | null },
  ): Promise<CustomerFavoriteEntity | null> {
    const conditions = [eq(customerFavorites.userId, userId)];

    if (target.businessId) {
      conditions.push(eq(customerFavorites.businessId, target.businessId));
    }
    if (target.staffMemberId) {
      conditions.push(eq(customerFavorites.staffMemberId, target.staffMemberId));
    }

    const [favorite] = await this.db
      .select()
      .from(customerFavorites)
      .where(and(...conditions))
      .limit(1);

    return (favorite as CustomerFavoriteEntity) ?? null;
  }

  /**
   * Lists all favorites saved by the user, newest first.
   */
  async findAllByUserId(userId: string): Promise<CustomerFavoriteEntity[]> {
    const favorites = await this.db
      .select()
      .from(customerFavorites)
      .where(eq(customerFavorites.userId, userId))
      .orderBy(desc(customerFavorites.createdAt));

    return favorites as CustomerFavoriteEntity[];
  }

  /**
   * Removes a favorite for the user.
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const [deleted] = await this.db
      .delete(customerFavorites)
      .where(and(eq(customerFavorites.id, id), eq(customerFavorites.userId, userId)))
      .returning({ id: customerFavorites.id });

    return !!deleted;
  }
}
