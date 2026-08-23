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
   */
  async businessExists(businessId: string): Promise<boolean> {
    const business = await this.businessRepository.findById(businessId);
    return Boolean(business);
  }
}
