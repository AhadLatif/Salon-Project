import { type db, serviceCategories } from '@salon/database';
import { ConflictError } from '@salon/shared';
import { and, eq } from 'drizzle-orm';
import type {
  CreateServiceCategoryData,
  IServiceCategoryRepository,
  UpdateServiceCategoryData,
} from '../../application/ports/service-category-repository.port.js';
import {
  ServiceCategoryEntity,
  type ServiceCategoryProps,
} from '../../domain/entities/service-category.entity.js';

export class ServiceCategoryRepository implements IServiceCategoryRepository {
  constructor(private readonly database: typeof db) {}

  private toDomainEntity(row: typeof serviceCategories.$inferSelect): ServiceCategoryEntity {
    return new ServiceCategoryEntity(row as ServiceCategoryProps);
  }

  async create(data: CreateServiceCategoryData): Promise<ServiceCategoryEntity> {
    try {
      const [newCategory] = await this.database
        .insert(serviceCategories)
        .values({
          businessId: data.businessId,
          name: data.name,
          description: data.description ?? null,
          displayOrder: data.displayOrder ?? 0,
        })
        .returning();

      if (!newCategory) {
        throw new Error('Failed to insert service category record.');
      }

      return this.toDomainEntity(newCategory);
    } catch (error) {
      const err = error as any;
      const code = err.cause?.code ?? err.code;
      const constraint = err.cause?.constraint ?? err.constraint;
      // Handle unique constraint violation (uq_service_categories_business_name)
      if (code === '23505' && constraint === 'uq_service_categories_business_name') {
        throw new ConflictError('A category with this name already exists in your business.');
      }
      throw error;
    }
  }

  async findById(
    businessId: string,
    categoryId: string,
    options?: { includeInactive?: boolean },
  ): Promise<ServiceCategoryEntity | null> {
    const filters = [
      eq(serviceCategories.id, categoryId),
      eq(serviceCategories.businessId, businessId),
    ];

    if (!options?.includeInactive) {
      filters.push(eq(serviceCategories.isActive, true));
    }

    const row = await this.database.query.serviceCategories.findFirst({
      where: and(...filters),
    });

    if (!row) return null;

    return this.toDomainEntity(row);
  }

  async findAllByBusinessId(
    businessId: string,
    options?: { includeInactive?: boolean },
  ): Promise<ServiceCategoryEntity[]> {
    const filters = [eq(serviceCategories.businessId, businessId)];

    if (!options?.includeInactive) {
      filters.push(eq(serviceCategories.isActive, true));
    }

    const categories = await this.database.query.serviceCategories.findMany({
      where: and(...filters),
      orderBy: (c, { asc }) => [asc(c.displayOrder), asc(c.name)],
    });

    return categories.map((row) => this.toDomainEntity(row));
  }

  async update(
    businessId: string,
    categoryId: string,
    data: UpdateServiceCategoryData,
  ): Promise<ServiceCategoryEntity | null> {
    try {
      const [updatedCategory] = await this.database
        .update(serviceCategories)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(
          and(eq(serviceCategories.id, categoryId), eq(serviceCategories.businessId, businessId)),
        )
        .returning();

      if (!updatedCategory) return null;

      return this.toDomainEntity(updatedCategory);
    } catch (error) {
      const err = error as any;
      const code = err.cause?.code ?? err.code;
      const constraint = err.cause?.constraint ?? err.constraint;
      if (code === '23505' && constraint === 'uq_service_categories_business_name') {
        throw new ConflictError('A category with this name already exists in your business.');
      }
      throw error;
    }
  }

  async deactivate(businessId: string, categoryId: string): Promise<boolean> {
    const [deactivated] = await this.database
      .update(serviceCategories)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(eq(serviceCategories.id, categoryId), eq(serviceCategories.businessId, businessId)),
      )
      .returning({ id: serviceCategories.id });

    return !!deactivated;
  }
}
