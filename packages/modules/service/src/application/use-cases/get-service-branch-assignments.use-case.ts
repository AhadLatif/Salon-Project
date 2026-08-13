import type { IServiceRepository } from '../ports/service-repository.port.js';

export class GetServiceBranchAssignmentsUseCase {
  constructor(private readonly serviceRepository: IServiceRepository) {}

  async execute(
    businessId: string,
    serviceId: string,
  ): Promise<{ branchId: string; isBookable: boolean }[]> {
    return await this.serviceRepository.getBranchAssignments(businessId, serviceId);
  }
}
