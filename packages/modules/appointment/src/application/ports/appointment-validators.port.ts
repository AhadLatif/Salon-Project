/**
 * Narrow validator and query ports for the appointment module.
 *
 * Each interface is declared here (consumer-side) so the appointment module
 * has no runtime dependency on the provider modules. The composition root
 * in apps/api wires the existing query services to satisfy these ports
 * structurally (same pattern as the customer/staff modules).
 */

export interface BranchOpeningHoursSnapshot {
  dayOfWeek: number;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  timezone?: string;
}

/** Verifies a branch belongs to a business tenant and retrieves opening hours. */
export interface IBranchValidator {
  isBranchInBusiness(businessId: string, branchId: string): Promise<boolean>;
  getBranchOpeningHoursForDay(
    businessId: string,
    branchId: string,
    dayOfWeek: number,
  ): Promise<BranchOpeningHoursSnapshot | null>;
}

/** Verifies a customer profile belongs to a business and is active. */
export interface ICustomerValidator {
  isCustomerInBusiness(businessId: string, customerId: string): Promise<boolean>;
}

export interface StaffBookingSnapshot {
  staffMemberId: string;
  serviceId: string;
  displayName: string;
  isActive: boolean;
  overridePrice: string | null;
  overrideDurationMinutes: number | null;
  isBookable: boolean;
}

export interface StaffScheduleCandidate {
  staffMemberId: string;
  overrideDurationMinutes: number | null;
  shifts: { startsAt: string; endsAt: string }[];
  timeOff: { startsAt: Date; endsAt: Date }[];
}

/** Verifies a staff member exists, is active, and provides scheduling and snapshot data. */
export interface IStaffValidator {
  /**
   * Whether an ACTIVE staff profile is currently assigned to the branch.
   *
   * NOTE the identifier: booking segments carry `staff_members.id`, NOT `business_members.id`.
   * This used to be named `hasStaffBranchAssignment` with the same signature, and the composition
   * root wired it straight to the staff module's query service of that name — which expects a
   * `business_members.id`. Both parameters are `string`, so TypeScript could not see the mismatch,
   * and the check answered `false` for every booking: the source of the 409
   * "Staff member ... is not assigned to branch ..." on a correctly-assigned staff member.
   *
   * The method is named after the identifier it accepts so that mix-up cannot compile again.
   */
  isStaffMemberAssignedToBranch(
    businessId: string,
    staffMemberId: string,
    branchId: string,
  ): Promise<boolean>;
  isStaffMemberActive(businessId: string, staffMemberId: string): Promise<boolean>;
  getStaffBookingSnapshots(
    businessId: string,
    requests: { staffMemberId: string; serviceId: string }[],
  ): Promise<StaffBookingSnapshot[]>;
  getStaffAvailabilitySchedule(
    businessId: string,
    criteria: {
      branchId: string;
      serviceId: string;
      date: string;
      dayOfWeek: number;
      staffMemberId?: string;
      dayStartUtc?: Date;
      dayEndUtc?: Date;
    },
  ): Promise<StaffScheduleCandidate[]>;
}

export interface ServiceSnapshot {
  id: string;
  name: string;
  defaultPrice: string;
  defaultDurationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  isActive: boolean;
}

/** Verifies a service belongs to a business and provides service snapshot data. */
export interface IServiceValidator {
  isServiceInBusiness(businessId: string, serviceId: string): Promise<boolean>;
  isServiceBookableAtBranch(
    businessId: string,
    serviceId: string,
    branchId: string,
  ): Promise<boolean>;
  getServiceSnapshots(businessId: string, serviceIds: string[]): Promise<ServiceSnapshot[]>;
  getServiceDetails(businessId: string, serviceId: string): Promise<ServiceSnapshot | null>;
}

/** Verifies a business member (employee) belongs to a business tenant. */
export interface IBusinessMemberValidator {
  isBusinessMemberInBusiness(businessId: string, businessMemberId: string): Promise<boolean>;
}
