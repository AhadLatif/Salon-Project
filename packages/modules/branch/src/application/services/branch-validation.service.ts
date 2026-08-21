import type { IBranchRepository } from '../ports/branch-repository.port.js';

export interface IBranchValidationService {
  isBranchInBusiness(businessId: string, branchId: string): Promise<boolean>;
}

/**
 * Service providing cross-module branch validation.
 * Encapsulates branch existence, tenant scoping, and status checks (excluding archived branches).
 */
export class BranchValidationService implements IBranchValidationService {
  constructor(private readonly branchRepository: IBranchRepository) {}

  /**
   * Verifies that a branch exists, belongs to the given business tenant, and is active.
   */
  async isBranchInBusiness(businessId: string, branchId: string): Promise<boolean> {
    return await this.branchRepository.isBranchInBusiness(businessId, branchId);
  }
}
