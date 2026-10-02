export type StaffStatus = 'active' | 'inactive' | 'terminated';
export type EmploymentType = 'full_time' | 'part_time' | 'contractor';

/**
 * The subset of a staff member that the domain invariants inspect.
 *
 * WHY THIS SHAPE EXISTS: the old class validated in its constructor, so checking a not-yet-persisted
 * staff member meant constructing one. A policy over exactly these fields removes that requirement
 * and, more importantly, removes the `row as StaffMemberProps` cast the repository used — a cast that
 * also papered over `languages` / `socialLinks` being jsonb (`unknown`) rather than typed arrays.
 */
export interface StaffMemberValidationInput {
  businessId: string;
  businessMemberId: string;
  displayName: string;
  jobTitle: string | null;
  biography: string | null;
}

/**
 * A staff member of a salon tenant.
 *
 * CONTRACT — maps 1:1 onto the `staff_members` row. `languages` and `socialLinks` are jsonb columns;
 * the repository NARROWS them to typed values instead of asserting them, so a malformed write cannot
 * publish junk to clients.
 *
 * WHY AN INTERFACE RATHER THAN A CLASS: the class only ran `validate()` in its constructor and offered
 * `toPrimitives()`. Because TypeScript erases `private` at runtime, such an instance is `{ props: {...} }`
 * and any code that forgot `toPrimitives()` would serialize the wrapper. A staff member is a bag of
 * fields, so it is modelled as a shape.
 *
 * NOTE ON `id`: required here (it was optional) because the class doubled as a pre-insert builder.
 */
export interface StaffMemberEntity {
  id: string;
  businessId: string;
  businessMemberId: string;
  status: StaffStatus;
  displayName: string;
  jobTitle: string | null;
  biography: string | null;
  avatarMediaId: string | null;
  employmentType: EmploymentType;
  hireDate: string | null;
  excludeFromAutoAssignment: boolean;
  languages: string[] | null;
  socialLinks: Record<string, string> | null;
  createdAt: Date;
  updatedAt: Date;
}
