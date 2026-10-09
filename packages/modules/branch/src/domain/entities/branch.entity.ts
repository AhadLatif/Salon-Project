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

/** Minimal branch fields required by `assertValidBranch` policy checks. */
export interface BranchValidationInput {
  businessId: string;
  name: string;
  countryCode: string;
  currency: string;
  openingHours: BranchOpeningHourInput[];
}

/**
 * Domain entity representing a branch location and its operational schedule.
 * Maps directly to the persisted `branches` row and related `opening_hours`.
 * Database-internal spatial columns (`location`) are excluded from the domain shape.
 */
export interface BranchEntity {
  id: string;
  businessId: string;
  name: string;
  phoneNumber: string | null;
  email: string | null;
  timezone: string; // e.g., 'America/New_York'
  currency: string; // e.g., 'USD'
  isPublished: boolean;
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
