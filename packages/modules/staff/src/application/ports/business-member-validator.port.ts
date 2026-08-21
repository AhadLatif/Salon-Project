/**
 * Consumer port for validating business member existence and tenant ownership.
 * Declared by the Staff module and satisfied by BusinessValidationService via Dependency Injection.
 */
export interface IBusinessMemberValidator {
  isBusinessMemberInBusiness(businessId: string, businessMemberId: string): Promise<boolean>;
}
