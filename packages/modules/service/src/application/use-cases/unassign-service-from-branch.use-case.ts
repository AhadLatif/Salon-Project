import { ResourceNotFoundError } from '@salon/shared';
import type { IServiceRepository } from '../ports/service-repository.port.js';

export class UnassignServiceFromBranchUseCase {
  constructor(private readonly serviceRepository: IServiceRepository) {}

  async execute(businessId: string, serviceId: string, branchId: string): Promise<void> {
    const unassigned = await this.serviceRepository.unassignFromBranch(
      businessId,
      serviceId,
      branchId,
    );

    if (!unassigned) {
      throw new ResourceNotFoundError('Service is not assigned to this branch');
    }
  }
}
