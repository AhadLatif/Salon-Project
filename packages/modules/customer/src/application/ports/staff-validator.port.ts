export interface IStaffValidator {
  /**
   * Verifies if a staff member exists and is active.
   */
  isStaffMemberActive(staffMemberId: string): Promise<boolean>;
}
