import type { StaffMemberEntity } from '../../domain/entities/staff-member.entity.js';

/**
 * Shapes a staff member for an HTTP response.
 *
 * WHY THIS EXISTS: the staff controller previously returned the entity instance directly
 * (`data: { staff }`), which happened to work only because the old class assigned `public readonly`
 * fields — i.e. it was serialising "whatever happens to be on the object", the same fragility that
 * `toPrimitives()` existed to solve elsewhere. This is the single, explicit allow-list instead, and it
 * returns exactly the fields that were being published before, so the JSON is unchanged.
 */
export interface StaffMemberResponse {
  id: string;
  businessId: string;
  businessMemberId: string;
  status: string;
  displayName: string;
  jobTitle: string | null;
  biography: string | null;
  avatarMediaId: string | null;
  employmentType: string;
  hireDate: string | null;
  excludeFromAutoAssignment: boolean;
  languages: string[] | null;
  socialLinks: Record<string, string> | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toStaffMemberResponse(staff: StaffMemberEntity): StaffMemberResponse {
  return {
    id: staff.id,
    businessId: staff.businessId,
    businessMemberId: staff.businessMemberId,
    status: staff.status,
    displayName: staff.displayName,
    jobTitle: staff.jobTitle,
    biography: staff.biography,
    avatarMediaId: staff.avatarMediaId,
    employmentType: staff.employmentType,
    hireDate: staff.hireDate,
    excludeFromAutoAssignment: staff.excludeFromAutoAssignment,
    languages: staff.languages,
    socialLinks: staff.socialLinks,
    createdAt: staff.createdAt,
    updatedAt: staff.updatedAt,
  };
}
