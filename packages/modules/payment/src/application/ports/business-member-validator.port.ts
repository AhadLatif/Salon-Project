/**
 * Narrow consumer port: verifies a business member belongs to a tenant.
 *
 * Used to record WHO captures a payment / authorizes a refund. Provided by the
 * Business module's validation service via structural typing at the composition
 * root. No hard dependency on @salon/business from this module.
 */
export interface IBusinessMemberValidator {
  isBusinessMemberInBusiness(businessId: string, businessMemberId: string): Promise<boolean>;
}
