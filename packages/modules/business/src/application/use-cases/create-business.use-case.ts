import { ConflictError } from '@salon/shared';
import type { BusinessEntity } from '../../domain/entities/business.entity.js';
import type {
  CreateBusinessWithOwnerData,
  IBusinessRepository,
} from '../ports/business-repository.port.js';

export class CreateBusinessUseCase {
  constructor(private readonly businessRepository: IBusinessRepository) {}

  async execute(command: CreateBusinessWithOwnerData): Promise<BusinessEntity> {
    // 1. Business rule check: ensure unique business slug before creating
    const existingBusiness = await this.businessRepository.findBySlug(command.business.slug);
    if (existingBusiness) {
      throw new ConflictError('A business with this slug already exists.');
    }

    // 2. Delegate persistence to repository
    return this.businessRepository.createWithOwner(command);
  }
}
