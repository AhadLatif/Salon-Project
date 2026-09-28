/**
 * Consumer port for validating service existence and active tenant ownership.
 * Declared by the Staff module and satisfied by ServiceQueryService via Dependency Injection.
 */
export interface IServiceValidator {
  isServiceInBusiness(businessId: string, serviceId: string): Promise<boolean>;
}
