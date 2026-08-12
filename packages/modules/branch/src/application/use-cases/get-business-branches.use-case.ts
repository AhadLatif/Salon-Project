import type { BranchEntity } from '../../domain/entities/branch.entity.js';
import type { IBranchRepository } from '../ports/branch-repository.port.js';

export class GetBusinessBranchesUseCase {
  constructor(private readonly branchRepository: IBranchRepository) {}

  async execute(businessId: string): Promise<BranchEntity[]> {
    return await this.branchRepository.findAllByBusinessId(businessId);
  }
}
