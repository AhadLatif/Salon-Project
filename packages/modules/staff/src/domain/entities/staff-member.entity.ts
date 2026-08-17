import { ValidationError } from '@salon/shared';

export type StaffStatus = 'active' | 'inactive' | 'terminated';
export type EmploymentType = 'full_time' | 'part_time' | 'contractor';

export interface StaffMemberProps {
  id?: string | undefined;
  businessId: string;
  businessMemberId: string;
  status?: StaffStatus | undefined;
  displayName: string;
  jobTitle?: string | null | undefined;
  biography?: string | null | undefined;
  avatarMediaId?: string | null | undefined;
  employmentType?: EmploymentType | undefined;
  hireDate?: string | null | undefined;
  excludeFromAutoAssignment?: boolean | undefined;
  languages?: string[] | null | undefined;
  socialLinks?: Record<string, string> | null | undefined;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
}

export class StaffMemberEntity {
  public readonly id?: string | undefined;
  public readonly businessId: string;
  public readonly businessMemberId: string;
  public readonly status: StaffStatus;
  public readonly displayName: string;
  public readonly jobTitle: string | null;
  public readonly biography: string | null;
  public readonly avatarMediaId: string | null;
  public readonly employmentType: EmploymentType;
  public readonly hireDate: string | null;
  public readonly excludeFromAutoAssignment: boolean;
  public readonly languages: string[] | null;
  public readonly socialLinks: Record<string, string> | null;
  public readonly createdAt?: Date | undefined;
  public readonly updatedAt?: Date | undefined;

  constructor(props: StaffMemberProps) {
    this.id = props.id;
    this.businessId = props.businessId;
    this.businessMemberId = props.businessMemberId;
    this.status = props.status ?? 'active';
    this.displayName = props.displayName;
    this.jobTitle = props.jobTitle ?? null;
    this.biography = props.biography ?? null;
    this.avatarMediaId = props.avatarMediaId ?? null;
    this.employmentType = props.employmentType ?? 'full_time';
    this.hireDate = props.hireDate ?? null;
    this.excludeFromAutoAssignment = props.excludeFromAutoAssignment ?? false;
    this.languages = props.languages ?? null;
    this.socialLinks = props.socialLinks ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;

    this.validate();
  }

  private validate(): void {
    if (!this.businessId) {
      throw new ValidationError(
        'Staff member must belong to a business tenant (businessId is required).',
        {
          businessId: 'Required',
        },
      );
    }
    if (!this.businessMemberId) {
      throw new ValidationError(
        'Staff member must link to a business member (businessMemberId is required).',
        {
          businessMemberId: 'Required',
        },
      );
    }
    if (!this.displayName || this.displayName.trim().length === 0) {
      throw new ValidationError('Staff display name cannot be empty.', {
        displayName: 'Cannot be empty',
      });
    }
    if (this.displayName.length > 200) {
      throw new ValidationError('Staff display name cannot exceed 200 characters.', {
        displayName: 'Too long',
      });
    }
    if (this.jobTitle && this.jobTitle.length > 100) {
      throw new ValidationError('Job title cannot exceed 100 characters.', {
        jobTitle: 'Too long',
      });
    }
    if (this.biography && this.biography.length > 2000) {
      throw new ValidationError('Biography cannot exceed 2000 characters.', {
        biography: 'Too long',
      });
    }
  }

  public toPrimitives(): Record<string, unknown> {
    return {
      id: this.id,
      businessId: this.businessId,
      businessMemberId: this.businessMemberId,
      status: this.status,
      displayName: this.displayName,
      jobTitle: this.jobTitle,
      biography: this.biography,
      avatarMediaId: this.avatarMediaId,
      employmentType: this.employmentType,
      hireDate: this.hireDate,
      excludeFromAutoAssignment: this.excludeFromAutoAssignment,
      languages: this.languages,
      socialLinks: this.socialLinks,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
