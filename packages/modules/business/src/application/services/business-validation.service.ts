import type { IBusinessRepository } from '../ports/business-repository.port.js';

export interface IBusinessValidationService {
  isBusinessMemberInBusiness(businessId: string, businessMemberId: string): Promise<boolean>;
  businessExists(businessId: string): Promise<boolean>;
}

/**
 * Service providing cross-module business validation.
 * Encapsulates tenant membership checks and workspace isolation rules.
 */
export class BusinessValidationService implements IBusinessValidationService {
  constructor(private readonly businessRepository: IBusinessRepository) {}

  /**
   * Verifies that a business member exists and belongs to the specified business tenant.
   */
  async isBusinessMemberInBusiness(businessId: string, businessMemberId: string): Promise<boolean> {
    return await this.businessRepository.isBusinessMemberInBusiness(businessId, businessMemberId);
  }

  /**
   * Verifies that a business tenant exists.
   *
   * Delegates to the repository's purpose-built existence probe rather than loading the entire row
   * and constructing a domain entity just to answer a boolean.
   *
   * SEMANTICS: existence only — a `suspended` or `archived` business still counts as existing.
   * Callers that must refuse a non-active tenant apply that rule themselves (the customer and branch
   * validators do). Making this active-only is a product decision, and it would have to be taken
   * consistently across all three modules, so it is deliberately not assumed here.
   */
  async businessExists(businessId: string): Promise<boolean> {
    return await this.businessRepository.exists(businessId);
  }
}
