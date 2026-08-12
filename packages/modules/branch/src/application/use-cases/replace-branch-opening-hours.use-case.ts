import { ResourceNotFoundError } from '@salon/shared';
import type { BranchEntity, OpeningHourProps } from '../../domain/entities/branch.entity.js';
import type { IBranchRepository } from '../ports/branch-repository.port.js';

export class ReplaceBranchOpeningHoursUseCase {
  constructor(private readonly branchRepository: IBranchRepository) {}

  async execute(
    businessId: string,
    branchId: string,
    hours: Omit<OpeningHourProps, 'id' | 'businessId' | 'branchId'>[],
  ): Promise<BranchEntity> {
    const updatedBranch = await this.branchRepository.replaceOpeningHours(
      businessId,
      branchId,
      hours,
    );

    if (!updatedBranch) {
      throw new ResourceNotFoundError('Branch not found.');
    }

    return updatedBranch;
  }
}
