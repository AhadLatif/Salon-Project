export interface IBusinessValidator {
  /**
   * Verifies if a business exists in the platform.
   */
  businessExists(businessId: string): Promise<boolean>;
}
