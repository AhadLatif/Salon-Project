import type { ServiceEntity } from '../../domain/entities/service.entity.js';

export interface CreateServiceData {
  businessId: string;
  categoryId: string;
  name: string;
  description?: string | null | undefined;
  defaultPrice: string;
  defaultDurationMinutes: number;
  bufferBeforeMinutes?: number | undefined;
  bufferAfterMinutes?: number | undefined;
  color?: string | null | undefined;
  isBookable?: boolean | undefined;
}

export interface UpdateServiceData {
  categoryId?: string | undefined;
  name?: string | undefined;
  description?: string | null | undefined;
  defaultPrice?: string | undefined;
  defaultDurationMinutes?: number | undefined;
  bufferBeforeMinutes?: number | undefined;
  bufferAfterMinutes?: number | undefined;
  color?: string | null | undefined;
  isBookable?: boolean | undefined;
  isActive?: boolean | undefined;
}

export interface IServiceRepository {
  create(data: CreateServiceData): Promise<ServiceEntity>;

  findById(
    businessId: string,
    serviceId: string,
    options?: { includeInactive?: boolean },
  ): Promise<ServiceEntity | null>;

  findAllByBusinessId(
    businessId: string,
    options?: { categoryId?: string; includeInactive?: boolean },
  ): Promise<ServiceEntity[]>;

  update(
    businessId: string,
    serviceId: string,
    data: UpdateServiceData,
  ): Promise<ServiceEntity | null>;

  deactivate(businessId: string, serviceId: string): Promise<boolean>;

  // --- Validations ---
  isServiceInBusiness(businessId: string, serviceId: string): Promise<boolean>;

  // --- Branch Assignments ---

  /**
   * Assigns a service to a branch.
   * Must ensure both service and branch belong to the same business.
   */
  assignToBranch(
    businessId: string,
    serviceId: string,
    branchId: string,
    isBookable?: boolean,
  ): Promise<boolean>;

  unassignFromBranch(businessId: string, serviceId: string, branchId: string): Promise<boolean>;

  /**
   * Returns a list of branch IDs where this service is assigned.
   */
  getBranchAssignments(
    businessId: string,
    serviceId: string,
  ): Promise<{ branchId: string; isBookable: boolean }[]>;
}
