import { ResourceNotFoundError } from '@salon/shared';
import type { IServiceRepository } from '../ports/service-repository.port.js';

export class DeactivateServiceUseCase {
  constructor(private readonly serviceRepository: IServiceRepository) {}

  async execute(businessId: string, serviceId: string): Promise<void> {
    const deactivated = await this.serviceRepository.deactivate(businessId, serviceId);

    if (!deactivated) {
      throw new ResourceNotFoundError('Service not found');
    }
  }
}
