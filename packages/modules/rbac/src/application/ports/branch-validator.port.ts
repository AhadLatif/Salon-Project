/**
 * Consumer port for validating branch existence and tenant ownership.
 * Declared by the RBAC module and satisfied by BranchQueryService via Dependency Injection.
 */
export interface IBranchValidator {
  isBranchInBusiness(businessId: string, branchId: string): Promise<boolean>;
}
