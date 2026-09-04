import type { IBranchRepository } from '../ports/branch-repository.port.js';

export interface BranchOpeningHoursSnapshot {
  dayOfWeek: number;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  timezone?: string;
}

export interface IBranchValidationService {
  isBranchInBusiness(businessId: string, branchId: string): Promise<boolean>;
  getBranchOpeningHoursForDay(
    businessId: string,
    branchId: string,
    dayOfWeek: number,
  ): Promise<BranchOpeningHoursSnapshot | null>;
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

  /**
   * Retrieves the opening hours for a specific branch and day of the week.
   */
  async getBranchOpeningHoursForDay(
    businessId: string,
    branchId: string,
    dayOfWeek: number,
  ): Promise<BranchOpeningHoursSnapshot | null> {
    const branch = await this.branchRepository.findById(businessId, branchId);
    if (branch?.status !== 'active') {
      return null;
    }

    const hour = branch.openingHours.find((h) => h.dayOfWeek === dayOfWeek);
    if (!hour) {
      return null;
    }

    return {
      dayOfWeek: hour.dayOfWeek,
      isClosed: hour.isClosed,
      opensAt: hour.opensAt,
      closesAt: hour.closesAt,
      timezone: branch.timezone,
    };
  }
}
