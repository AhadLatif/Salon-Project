import { ResourceNotFoundError } from '@salon/shared';
import type { BranchEntity } from '../../domain/entities/branch.entity.js';
import type { IBranchRepository } from '../ports/branch-repository.port.js';

export class GetBranchByIdUseCase {
  constructor(private readonly branchRepository: IBranchRepository) {}

  async execute(businessId: string, branchId: string): Promise<BranchEntity> {
    const branch = await this.branchRepository.findById(businessId, branchId);

    if (!branch) {
      throw new ResourceNotFoundError('Branch not found.');
    }

    return branch;
  }
}
