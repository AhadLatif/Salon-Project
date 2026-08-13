import { branches, branchServices, type db, services } from '@salon/database';
import { ConflictError } from '@salon/shared';
import { and, eq, ne } from 'drizzle-orm';
import type {
  CreateServiceData,
  IServiceRepository,
  UpdateServiceData,
} from '../../application/ports/service-repository.port.js';
import { ServiceEntity, type ServiceProps } from '../../domain/entities/service.entity.js';

export class ServiceRepository implements IServiceRepository {
  constructor(private readonly database: typeof db) {}

  private toDomainEntity(row: typeof services.$inferSelect): ServiceEntity {
    return new ServiceEntity(row as ServiceProps);
  }

  async create(data: CreateServiceData): Promise<ServiceEntity> {
    try {
      const [newService] = await this.database
        .insert(services)
        .values({
          businessId: data.businessId,
          categoryId: data.categoryId,
          name: data.name,
          description: data.description ?? null,
          defaultPrice: data.defaultPrice,
          defaultDurationMinutes: data.defaultDurationMinutes,
          bufferBeforeMinutes: data.bufferBeforeMinutes ?? 0,
          bufferAfterMinutes: data.bufferAfterMinutes ?? 0,
          color: data.color ?? null,
          isBookable: data.isBookable ?? true,
        })
        .returning();

      if (!newService) {
        throw new Error('Failed to insert service record.');
      }

      return this.toDomainEntity(newService);
    } catch (error) {
      const err = error as Error & { code?: string; constraint?: string };
      if (err.code === '23505' && err.constraint === 'uq_services_business_name') {
        throw new ConflictError('A service with this name already exists in your business.');
      }
      throw error;
    }
  }

  async findById(
    businessId: string,
    serviceId: string,
    options?: { includeInactive?: boolean },
  ): Promise<ServiceEntity | null> {
    const filters = [eq(services.id, serviceId), eq(services.businessId, businessId)];

    if (!options?.includeInactive) {
      filters.push(eq(services.isActive, true));
    }

    const row = await this.database.query.services.findFirst({
      where: and(...filters),
    });

    if (!row) return null;

    return this.toDomainEntity(row);
  }

  async findAllByBusinessId(
    businessId: string,
    options?: { categoryId?: string; includeInactive?: boolean },
  ): Promise<ServiceEntity[]> {
    const filters = [eq(services.businessId, businessId)];

    if (options?.categoryId) {
      filters.push(eq(services.categoryId, options.categoryId));
    }

    if (!options?.includeInactive) {
      filters.push(eq(services.isActive, true));
    }

    const serviceRows = await this.database.query.services.findMany({
      where: and(...filters),
      orderBy: (s, { asc }) => [asc(s.name)],
    });

    return serviceRows.map((row) => this.toDomainEntity(row));
  }

  async update(
    businessId: string,
    serviceId: string,
    data: UpdateServiceData,
  ): Promise<ServiceEntity | null> {
    try {
      const [updatedService] = await this.database
        .update(services)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(and(eq(services.id, serviceId), eq(services.businessId, businessId)))
        .returning();

      if (!updatedService) return null;

      return this.toDomainEntity(updatedService);
    } catch (error) {
      const err = error as Error & { code?: string; constraint?: string };
      if (err.code === '23505' && err.constraint === 'uq_services_business_name') {
        throw new ConflictError('A service with this name already exists in your business.');
      }
      throw error;
    }
  }

  async deactivate(businessId: string, serviceId: string): Promise<boolean> {
    const [deactivated] = await this.database
      .update(services)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(services.id, serviceId), eq(services.businessId, businessId)))
      .returning({ id: services.id });

    return !!deactivated;
  }

  // --- Branch Assignments ---

  async isBranchInBusiness(businessId: string, branchId: string): Promise<boolean> {
    const branch = await this.database.query.branches.findFirst({
      where: and(
        eq(branches.id, branchId),
        eq(branches.businessId, businessId),
        ne(branches.status, 'archived'),
      ),
      columns: { id: true },
    });
    return !!branch;
  }

  async assignToBranch(
    businessId: string,
    serviceId: string,
    branchId: string,
    isBookable?: boolean,
  ): Promise<boolean> {
    const [inserted] = await this.database
      .insert(branchServices)
      .values({
        businessId,
        serviceId,
        branchId,
        isBookable: isBookable ?? true,
      })
      .onConflictDoNothing({
        target: [branchServices.branchId, branchServices.serviceId],
      })
      .returning({ id: branchServices.id });

    return !!inserted;
  }

  async unassignFromBranch(
    businessId: string,
    serviceId: string,
    branchId: string,
  ): Promise<boolean> {
    const [deleted] = await this.database
      .delete(branchServices)
      .where(
        and(
          eq(branchServices.businessId, businessId),
          eq(branchServices.serviceId, serviceId),
          eq(branchServices.branchId, branchId),
        ),
      )
      .returning({ id: branchServices.id });

    return !!deleted;
  }

  async getBranchAssignments(
    businessId: string,
    serviceId: string,
  ): Promise<{ branchId: string; isBookable: boolean }[]> {
    const assignments = await this.database.query.branchServices.findMany({
      where: and(
        eq(branchServices.businessId, businessId),
        eq(branchServices.serviceId, serviceId),
      ),
    });

    return assignments.map((a) => ({ branchId: a.branchId, isBookable: a.isBookable }));
  }
}
