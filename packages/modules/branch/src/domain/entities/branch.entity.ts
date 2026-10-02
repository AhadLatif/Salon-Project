export type BranchStatus = 'active' | 'inactive' | 'archived';

/** One opening-hours row for a branch (a day may legitimately have several shifts). */
export interface OpeningHourProps {
  id?: string;
  businessId: string;
  branchId: string;
  dayOfWeek: number; // 1 (Monday) to 7 (Sunday)
  shiftName: string | null;
  isClosed: boolean;
  opensAt: string | null; // e.g., '09:00:00'
  closesAt: string | null; // e.g., '17:00:00'
}

/** The opening-hours fields the domain invariants actually inspect. */
export interface BranchOpeningHourInput {
  dayOfWeek: number;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
}

/**
 * The subset of a branch that the domain invariants examine.
 *
 * WHY THIS SHAPE EXISTS: the old `BranchEntity` validated inside its constructor, so validating a
 * branch that had not been persisted yet meant inventing one — `BranchRepository.create` fabricated
 * a whole entity with a hard-coded placeholder UUID and synthesised hour ids
 * (`` `00000000-0000-0000-0000-00000000000${index}` ``) purely to trigger the check. A policy that
 * takes exactly the fields it inspects removes that need: a real row satisfies this shape, and so
 * does a prospective create payload. The fabricated values are gone, so a bad placeholder can never
 * make validation pass for the wrong reason.
 */
export interface BranchValidationInput {
  businessId: string;
  name: string;
  countryCode: string;
  currency: string;
  openingHours: BranchOpeningHourInput[];
}

/**
 * A salon location.
 *
 * CONTRACT — maps 1:1 onto the `branches` row plus `openingHours`, which the repository assembles
 * from the `opening_hours` table (a branch is conceptually incomplete without its hours).
 *
 * WHY AN INTERFACE RATHER THAN A CLASS: the class existed to run `validate()` in its constructor and
 * to expose `toJSON()`. TypeScript erases `private` at runtime, so the instance was physically
 * `{ props: {...} }` and any response that forgot `toJSON()` would have serialised the wrapper rather
 * than the branch. A branch is a bag of fields, so it is a shape; `toBranchResponse` owns what leaves
 * the module, and `assertValidBranch` owns the invariants.
 *
 * NOTE ON `id`: required here (it was optional) because the class doubled as a pre-insert builder,
 * which is exactly what forced the placeholder-UUID hack above. Rows always carry an id.
 */
export interface BranchEntity {
  id: string;
  businessId: string;
  name: string;
  phoneNumber: string | null;
  email: string | null;
  timezone: string;
  currency: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  countryCode: string;
  latitude: string | null;
  longitude: string | null;
  status: BranchStatus;
  openingHours: OpeningHourProps[];
  createdAt: Date;
  updatedAt: Date;
}
