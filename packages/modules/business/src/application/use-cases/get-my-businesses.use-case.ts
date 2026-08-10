import type { BusinessEntity } from '../../domain/entities/business.entity.js';
import type { IBusinessRepository } from '../ports/business-repository.port.js';

export class GetMyBusinessesUseCase {
  constructor(private readonly businessRepository: IBusinessRepository) {}

  async execute(userId: string): Promise<BusinessEntity[]> {
    return this.businessRepository.getUserBusinesses(userId);
  }
}
