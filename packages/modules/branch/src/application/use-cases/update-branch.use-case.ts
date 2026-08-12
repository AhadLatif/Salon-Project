import { ResourceNotFoundError } from '@salon/shared';
import type { BranchEntity } from '../../domain/entities/branch.entity.js';
import type { IBranchRepository, UpdateBranchData } from '../ports/branch-repository.port.js';

export class UpdateBranchUseCase {
  constructor(private readonly branchRepository: IBranchRepository) {}

  async execute(
    businessId: string,
    branchId: string,
    data: UpdateBranchData,
  ): Promise<BranchEntity> {
    const updatedBranch = await this.branchRepository.update(businessId, branchId, data);

    if (!updatedBranch) {
      throw new ResourceNotFoundError('Branch not found.');
    }

    return updatedBranch;
  }
}
