import { ValidationError } from '@salon/shared';
import type { StaffMemberValidationInput } from '../entities/staff-member.entity.js';

/**
 * Domain invariants for a staff member.
 *
 * WHY A POLICY RATHER THAN A CONSTRUCTOR: these rules lived in `StaffMemberEntity.validate()`, so
 * applying them to a database row required constructing an instance — which is what forced
 * `StaffRepository.toDomainEntity` into `new StaffMemberEntity(row as StaffMemberProps)`. A pure
 * function removes the construction and, with it, the cast.
 *
 * ⚠️ RULES MOVED VERBATIM. Error type, messages and field maps are unchanged because the API surfaces
 * them. None of these rules is enforced by the `staff_members` schema, so direct SQL writes can
 * produce rows this policy rejects — that is intentional (domain stricter than schema), not an oversight.
 */
export function assertValidStaffMember(staff: StaffMemberValidationInput): void {
  if (!staff.businessId) {
    throw new ValidationError(
      'Staff member must belong to a business tenant (businessId is required).',
      {
        businessId: 'Required',
      },
    );
  }
  if (!staff.businessMemberId) {
    throw new ValidationError(
      'Staff member must link to a business member (businessMemberId is required).',
      {
        businessMemberId: 'Required',
      },
    );
  }
  if (!staff.displayName || staff.displayName.trim().length === 0) {
    throw new ValidationError('Staff display name cannot be empty.', {
      displayName: 'Cannot be empty',
    });
  }
  if (staff.displayName.length > 200) {
    throw new ValidationError('Staff display name cannot exceed 200 characters.', {
      displayName: 'Too long',
    });
  }
  if (staff.jobTitle && staff.jobTitle.length > 100) {
    throw new ValidationError('Job title cannot exceed 100 characters.', {
      jobTitle: 'Too long',
    });
  }
  if (staff.biography && staff.biography.length > 2000) {
    throw new ValidationError('Biography cannot exceed 2000 characters.', {
      biography: 'Too long',
    });
  }
}
