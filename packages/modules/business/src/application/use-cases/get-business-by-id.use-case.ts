import { ResourceNotFoundError } from '@salon/shared';
import type { BusinessEntity } from '../../domain/entities/business.entity.js';
import type { IBusinessRepository } from '../ports/business-repository.port.js';

export class GetBusinessByIdUseCase {
  constructor(private readonly businessRepository: IBusinessRepository) {}

  async execute(businessId: string): Promise<BusinessEntity> {
    const business = await this.businessRepository.findById(businessId);
    if (!business) {
      throw new ResourceNotFoundError('Business not found.');
    }
    return business;
  }
}
