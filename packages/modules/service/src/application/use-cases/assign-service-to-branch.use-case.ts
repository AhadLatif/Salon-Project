import { ConflictError, ForbiddenError } from '@salon/shared';
import type { IBranchValidator } from '../ports/branch-validator.port.js';
import type { IServiceRepository } from '../ports/service-repository.port.js';

export class AssignServiceToBranchUseCase {
  constructor(
    private readonly serviceRepository: IServiceRepository,
    private readonly branchValidator: IBranchValidator,
  ) {}

  async execute(
    businessId: string,
    serviceId: string,
    branchId: string,
    isBookable?: boolean,
  ): Promise<void> {
    // 1. Cross-tenant IDOR guard: Validate branch exists and belongs to this business
    const isBranchValid = await this.branchValidator.isBranchInBusiness(businessId, branchId);
    if (!isBranchValid) {
      throw new ForbiddenError('Invalid branch ID or branch does not belong to this business');
    }

    // 2. Validate service exists, belongs to business, and is active
    const service = await this.serviceRepository.findById(businessId, serviceId, {
      includeInactive: false,
    });
    if (!service) {
      throw new ConflictError('Cannot assign an inactive or non-existent service to a branch');
    }

    // 3. Delegate to repository (atomic write)
    const success = await this.serviceRepository.assignToBranch(
      businessId,
      serviceId,
      branchId,
      isBookable,
    );

    if (!success) {
      throw new ConflictError('Service is already assigned to this branch');
    }
  }
}
