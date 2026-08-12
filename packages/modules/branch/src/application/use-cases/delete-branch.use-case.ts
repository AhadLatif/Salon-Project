import { ResourceNotFoundError } from '@salon/shared';
import type { IBranchRepository } from '../ports/branch-repository.port.js';

export class DeleteBranchUseCase {
  constructor(private readonly branchRepository: IBranchRepository) {}

  async execute(businessId: string, branchId: string): Promise<void> {
    const deleted = await this.branchRepository.delete(businessId, branchId);

    if (!deleted) {
      throw new ResourceNotFoundError('Branch not found.');
    }
  }
}
