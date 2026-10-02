import type { BranchEntity } from '../../domain/entities/branch.entity.js';

/**
 * Shapes a branch (with its opening hours) for an HTTP response.
 *
 * WHY THIS EXISTS: replaces `BranchEntity.toJSON()`. Besides being the single allow-list for what a
 * branch endpoint exposes, it preserves a subtle behaviour of the old serializer that is easy to lose
 * in a refactor — `openingHours` was deliberately narrowed to four fields, dropping the internal
 * `id`, `businessId` and `branchId` of each hours row. Returning the raw rows here would silently
 * start publishing internal row ids and the tenant/branch foreign keys.
 */
export interface BranchOpeningHourResponse {
  dayOfWeek: number;
  shiftName: string | null;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
}

export interface BranchResponse {
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
  status: string;
  openingHours: BranchOpeningHourResponse[];
  createdAt: Date;
  updatedAt: Date;
}

export function toBranchResponse(branch: BranchEntity): BranchResponse {
  return {
    id: branch.id,
    businessId: branch.businessId,
    name: branch.name,
    phoneNumber: branch.phoneNumber,
    email: branch.email,
    timezone: branch.timezone,
    currency: branch.currency,
    addressLine1: branch.addressLine1,
    addressLine2: branch.addressLine2,
    city: branch.city,
    state: branch.state,
    postalCode: branch.postalCode,
    countryCode: branch.countryCode,
    latitude: branch.latitude,
    longitude: branch.longitude,
    status: branch.status,
    // Deliberately narrows each hours row (see the note above).
    openingHours: branch.openingHours.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      shiftName: h.shiftName,
      isClosed: h.isClosed,
      opensAt: h.opensAt,
      closesAt: h.closesAt,
    })),
    createdAt: branch.createdAt,
    updatedAt: branch.updatedAt,
  };
}
