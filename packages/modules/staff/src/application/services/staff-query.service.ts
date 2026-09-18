import type {
  IStaffRepository,
  StaffBookingSnapshot,
  StaffScheduleCandidate,
} from '../ports/staff-repository.port.js';

export type { StaffBookingSnapshot, StaffScheduleCandidate };

export interface IStaffQueryService {
  hasStaffBranchAssignment(
    businessId: string,
    businessMemberId: string,
    branchId: string,
  ): Promise<boolean>;
  /**
   * Whether an ACTIVE staff profile is currently assigned to a branch.
   *
   * Kept distinct from `hasStaffBranchAssignment` on purpose: that one takes a
   * `business_members.id` (what the RBAC branch-context middleware holds), while booking flows
   * only know the staff profile id carried by the appointment segments. Both are plain `string`
   * to TypeScript, so only the method name prevents one being passed where the other is expected
   * — a mix-up that previously type-checked fine and made every dashboard booking fail with
   * "Staff member ... is not assigned to branch ...".
   */
  isStaffMemberAssignedToBranch(
    businessId: string,
    staffMemberId: string,
    branchId: string,
  ): Promise<boolean>;
  isStaffMemberActive(businessId: string, staffMemberId: string): Promise<boolean>;
  isStaffMemberActive(staffMemberId: string): Promise<boolean>;
  isStaffMemberActive(businessIdOrStaffId: string, maybeStaffMemberId?: string): Promise<boolean>;
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

/**
 * Service providing cross-module staff and scheduling queries.
 * Encapsulates staff profile lookups, branch assignments, and shift availability.
 */
export class StaffQueryService implements IStaffQueryService {
  constructor(private readonly staffRepository: IStaffRepository) {}

  /**
   * Verifies that a business member has an active staff profile assigned to the branch.
   */
  async hasStaffBranchAssignment(
    businessId: string,
    businessMemberId: string,
    branchId: string,
  ): Promise<boolean> {
    return await this.staffRepository.hasStaffBranchAssignment(
      businessId,
      businessMemberId,
      branchId,
    );
  }

  /**
   * Verifies that an active STAFF PROFILE is assigned to the branch — see the interface note for
   * why this is a separate method rather than a parameter of `hasStaffBranchAssignment`.
   */
  async isStaffMemberAssignedToBranch(
    businessId: string,
    staffMemberId: string,
    branchId: string,
  ): Promise<boolean> {
    return await this.staffRepository.isStaffMemberAssignedToBranch(
      businessId,
      staffMemberId,
      branchId,
    );
  }

  /**
   * Verifies that a staff member profile exists, is active, and belongs to the given business tenant.
   */
  async isStaffMemberActive(businessId: string, staffMemberId: string): Promise<boolean>;
  async isStaffMemberActive(staffMemberId: string): Promise<boolean>;
  async isStaffMemberActive(
    businessIdOrStaffId: string,
    maybeStaffMemberId?: string,
  ): Promise<boolean> {
    return await this.staffRepository.isStaffMemberActive(businessIdOrStaffId, maybeStaffMemberId);
  }

  /**
   * Resolves staff display names and service-override prices/durations for booking.
   */
  async getStaffBookingSnapshots(
    businessId: string,
    requests: { staffMemberId: string; serviceId: string }[],
  ): Promise<StaffBookingSnapshot[]> {
    return await this.staffRepository.getStaffBookingSnapshots(businessId, requests);
  }

  /**
   * Resolves candidate staff, their working shifts, and approved time off for a branch/service on a given date.
   */
  async getStaffAvailabilitySchedule(
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
  ): Promise<StaffScheduleCandidate[]> {
    return await this.staffRepository.getStaffAvailabilitySchedule(businessId, criteria);
  }
}
