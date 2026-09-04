import type {
  StaffMemberEntity,
  StaffMemberProps,
} from '../../domain/entities/staff-member.entity.js';

export interface CreateStaffMemberData {
  businessId: string;
  businessMemberId: string;
  displayName: string;
  jobTitle?: string | null | undefined;
  biography?: string | null | undefined;
  avatarMediaId?: string | null | undefined;
  employmentType?: 'full_time' | 'part_time' | 'contractor' | undefined;
  hireDate?: string | null | undefined;
  excludeFromAutoAssignment?: boolean | undefined;
  languages?: string[] | null | undefined;
  socialLinks?: Record<string, string> | null | undefined;
}

export interface UpdateStaffMemberData {
  displayName?: string | undefined;
  jobTitle?: string | null | undefined;
  biography?: string | null | undefined;
  avatarMediaId?: string | null | undefined;
  employmentType?: 'full_time' | 'part_time' | 'contractor' | undefined;
  hireDate?: string | null | undefined;
  excludeFromAutoAssignment?: boolean | undefined;
  languages?: string[] | null | undefined;
  socialLinks?: Record<string, string> | null | undefined;
  status?: 'active' | 'inactive' | 'terminated' | undefined;
}

export interface StaffBranchAssignment {
  id: string;
  businessId: string;
  staffMemberId: string;
  branchId: string;
  isPrimary: boolean;
  assignedAt: Date;
  unassignedAt: Date | null;
}

export interface StaffServiceAssignment {
  id: string;
  businessId: string;
  serviceId: string;
  staffMemberId: string;
  overridePrice: string | null;
  overrideDurationMinutes: number | null;
  isBookable: boolean;
}

export interface StaffWorkSchedule {
  id: string;
  businessId: string;
  staffMemberId: string;
  branchId: string;
  recurrencePattern: 'weekly' | 'biweekly' | 'triweekly' | 'four_weekly';
  effectiveFrom: string;
  effectiveUntil: string | null;
}

export interface StaffScheduleShift {
  id: string;
  workScheduleId: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
}

export interface StaffMemberWithRelations extends StaffMemberProps {
  branchAssignments: StaffBranchAssignment[];
  serviceAssignments: StaffServiceAssignment[];
  workSchedules: (StaffWorkSchedule & { shifts: StaffScheduleShift[] })[];
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

export interface IStaffRepository {
  create(data: CreateStaffMemberData): Promise<StaffMemberEntity>;
  findById(businessId: string, staffMemberId: string): Promise<StaffMemberEntity | null>;
  isStaffMemberActive(businessId: string, staffMemberId: string): Promise<boolean>;
  isStaffMemberActive(staffMemberId: string): Promise<boolean>;
  isStaffMemberActive(businessIdOrStaffId: string, maybeStaffMemberId?: string): Promise<boolean>;
  findAllByBusinessId(businessId: string): Promise<StaffMemberEntity[]>;
  update(
    businessId: string,
    staffMemberId: string,
    data: UpdateStaffMemberData,
  ): Promise<StaffMemberEntity | null>;
  deactivate(businessId: string, staffMemberId: string): Promise<boolean>;
  isWorkScheduleInBusinessAndBranch(
    businessId: string,
    branchId: string,
    workScheduleId: string,
  ): Promise<boolean>;
  hasStaffBranchAssignment(
    businessId: string,
    businessMemberId: string,
    branchId: string,
  ): Promise<boolean>;
  assignToBranch(
    businessId: string,
    staffMemberId: string,
    branchId: string,
    isPrimary?: boolean,
  ): Promise<StaffBranchAssignment>;
  unassignFromBranch(businessId: string, staffMemberId: string, branchId: string): Promise<boolean>;
  getBranchAssignments(businessId: string, staffMemberId: string): Promise<StaffBranchAssignment[]>;
  assignService(
    businessId: string,
    staffMemberId: string,
    serviceId: string,
    data?: {
      overridePrice?: string | null | undefined;
      overrideDurationMinutes?: number | null | undefined;
      isBookable?: boolean | undefined;
    },
  ): Promise<StaffServiceAssignment>;
  unassignService(businessId: string, staffMemberId: string, serviceId: string): Promise<boolean>;
  getServiceAssignments(
    businessId: string,
    staffMemberId: string,
  ): Promise<StaffServiceAssignment[]>;
  createWorkSchedule(
    businessId: string,
    staffMemberId: string,
    branchId: string,
    data: {
      recurrencePattern: 'weekly' | 'biweekly' | 'triweekly' | 'four_weekly';
      effectiveFrom: string;
      effectiveUntil?: string | null | undefined;
    },
  ): Promise<StaffWorkSchedule>;
  addShiftToSchedule(
    workScheduleId: string,
    data: { dayOfWeek: number; startsAt: string; endsAt: string },
  ): Promise<StaffScheduleShift>;
  getWorkSchedules(
    businessId: string,
    staffMemberId: string,
    branchId?: string,
  ): Promise<(StaffWorkSchedule & { shifts: StaffScheduleShift[] })[]>;
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
