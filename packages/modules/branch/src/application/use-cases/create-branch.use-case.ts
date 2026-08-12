import type { BranchEntity } from '../../domain/entities/branch.entity.js';
import type { CreateBranchData, IBranchRepository } from '../ports/branch-repository.port.js';

export class CreateBranchUseCase {
  constructor(private readonly branchRepository: IBranchRepository) {}

  /**
   * Executes the creation of a new branch.
   * Note: The BranchEntity constructor inherently validates the domain logic,
   * including the opening hours validity.
   */
  async execute(data: CreateBranchData): Promise<BranchEntity> {
    // TODO: 1. We would add business logic here (e.g., checking subscription limits for max branches)

    // 2. Delegate to repository
    return await this.branchRepository.create(data);
  }
}
