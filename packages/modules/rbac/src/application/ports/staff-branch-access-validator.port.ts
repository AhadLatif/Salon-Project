/**
 * Consumer port for validating staff member branch assignment.
 * Declared by the RBAC module and satisfied by StaffQueryService via Dependency Injection.
 */
export interface IStaffBranchAccessValidator {
  hasStaffBranchAssignment(
    businessId: string,
    businessMemberId: string,
    branchId: string,
  ): Promise<boolean>;
}
