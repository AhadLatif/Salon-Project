import { ResourceNotFoundError } from '@salon/shared';
import type { BusinessEntity } from '../../domain/entities/business.entity.js';
import type { IBusinessRepository, UpdateBusinessData } from '../ports/business-repository.port.js';

export class UpdateBusinessUseCase {
  constructor(private readonly businessRepository: IBusinessRepository) {}

  async execute(businessId: string, data: UpdateBusinessData): Promise<BusinessEntity> {
    const updated = await this.businessRepository.update(businessId, data);
    if (!updated) {
      throw new ResourceNotFoundError('Business not found.');
    }
    return updated;
  }
}
