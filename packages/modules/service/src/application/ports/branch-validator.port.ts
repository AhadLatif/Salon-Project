/**
 * Consumer port for validating branch existence and tenant ownership.
 * Declared by the Service module and satisfied by BranchValidationService via Dependency Injection.
 */
export interface IBranchValidator {
  isBranchInBusiness(businessId: string, branchId: string): Promise<boolean>;
}
