import {
  type db,
  staffBranchAssignments,
  staffMembers,
  staffScheduleShifts,
  staffServices,
  staffWorkSchedules,
} from '@salon/database';
import { ConflictError, handleUniqueConstraint, ValidationError } from '@salon/shared';
import { and, eq, isNull, ne } from 'drizzle-orm';
import type {
  CreateStaffMemberData,
  IStaffRepository,
  StaffBranchAssignment,
  StaffScheduleShift,
  StaffServiceAssignment,
  StaffWorkSchedule,
  UpdateStaffMemberData,
} from '../../application/ports/staff-repository.port.js';
import {
  StaffMemberEntity,
  type StaffMemberProps,
} from '../../domain/entities/staff-member.entity.js';

export class StaffRepository implements IStaffRepository {
  constructor(private readonly database: typeof db) {}

  private toDomainEntity(row: typeof staffMembers.$inferSelect): StaffMemberEntity {
    return new StaffMemberEntity(row as StaffMemberProps);
  }

  /**
   * Maps a raw `staff_branch_assignments` row to the domain-facing assignment shape.
   * Centralizes the mapping so the CAS branches in `assignToBranch` don't each
   * hand-roll the same object literal (which was a source of drift).
   */
  private toAssignment(row: typeof staffBranchAssignments.$inferSelect): StaffBranchAssignment {
    return {
      id: row.id,
      businessId: row.businessId,
      staffMemberId: row.staffMemberId,
      branchId: row.branchId,
      isPrimary: row.isPrimary,
      assignedAt: row.assignedAt,
      unassignedAt: row.unassignedAt,
    };
  }

  async create(data: CreateStaffMemberData): Promise<StaffMemberEntity> {
    try {
      const [newStaff] = await this.database
        .insert(staffMembers)
        .values({
          businessId: data.businessId,
          businessMemberId: data.businessMemberId,
          displayName: data.displayName,
          jobTitle: data.jobTitle ?? null,
          biography: data.biography ?? null,
          avatarMediaId: data.avatarMediaId ?? null,
          employmentType: data.employmentType ?? 'full_time',
          hireDate: data.hireDate ?? null,
          excludeFromAutoAssignment: data.excludeFromAutoAssignment ?? false,
          languages: data.languages ?? null,
          socialLinks: data.socialLinks ?? null,
        })
        .returning();

      if (!newStaff) {
        throw new Error('Failed to insert staff member record.');
      }

      return this.toDomainEntity(newStaff);
    } catch (error: unknown) {
      handleUniqueConstraint(error, {
        staff_members_business_member_id_unique:
          'This business member already has a staff profile.',
        business_member: 'This business member already has a staff profile.',
      });
    }
  }

  async findById(businessId: string, staffMemberId: string): Promise<StaffMemberEntity | null> {
    const row = await this.database.query.staffMembers.findFirst({
      where: and(
        eq(staffMembers.id, staffMemberId),
        eq(staffMembers.businessId, businessId),
        ne(staffMembers.status, 'terminated'),
      ),
    });

    if (!row) return null;

    return this.toDomainEntity(row);
  }

  async isStaffMemberActive(staffMemberId: string): Promise<boolean> {
    const [staff] = await this.database
      .select({ id: staffMembers.id })
      .from(staffMembers)
      .where(and(eq(staffMembers.id, staffMemberId), eq(staffMembers.status, 'active')))
      .limit(1);

    return Boolean(staff);
  }

  async findAllByBusinessId(businessId: string): Promise<StaffMemberEntity[]> {
    const rows = await this.database.query.staffMembers.findMany({
      where: and(eq(staffMembers.businessId, businessId), ne(staffMembers.status, 'terminated')),
      orderBy: (s, { asc }) => [asc(s.displayName)],
    });

    return rows.map((row) => this.toDomainEntity(row));
  }

  async update(
    businessId: string,
    staffMemberId: string,
    data: UpdateStaffMemberData,
  ): Promise<StaffMemberEntity | null> {
    const [updated] = await this.database
      .update(staffMembers)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(staffMembers.id, staffMemberId), eq(staffMembers.businessId, businessId)))
      .returning();

    if (!updated) return null;

    return this.toDomainEntity(updated);
  }

  /**
   * Soft-deletes a staff member by setting their status to 'terminated'.
   * We never hard-delete to preserve historical booking and financial integrity.
   */
  async deactivate(businessId: string, staffMemberId: string): Promise<boolean> {
    const [deactivated] = await this.database
      .update(staffMembers)
      .set({ status: 'terminated', updatedAt: new Date() })
      .where(and(eq(staffMembers.id, staffMemberId), eq(staffMembers.businessId, businessId)))
      .returning({ id: staffMembers.id });

    return Boolean(deactivated);
  }

  /**
   * Checks whether a business member has an active (non-terminated) staff profile
   * that is actively assigned to the given branch.
   * Used for cross-module RBAC branch-level access control.
   */
  async hasStaffBranchAssignment(
    businessId: string,
    businessMemberId: string,
    branchId: string,
  ): Promise<boolean> {
    const [staff] = await this.database
      .select({ id: staffMembers.id })
      .from(staffMembers)
      .where(
        and(
          eq(staffMembers.businessId, businessId),
          eq(staffMembers.businessMemberId, businessMemberId),
          ne(staffMembers.status, 'terminated'),
        ),
      )
      .limit(1);

    if (!staff) return false;

    const [assignment] = await this.database
      .select({ id: staffBranchAssignments.id })
      .from(staffBranchAssignments)
      .where(
        and(
          eq(staffBranchAssignments.businessId, businessId),
          eq(staffBranchAssignments.staffMemberId, staff.id),
          eq(staffBranchAssignments.branchId, branchId),
          isNull(staffBranchAssignments.unassignedAt),
        ),
      )
      .limit(1);

    return Boolean(assignment);
  }

  async isWorkScheduleInBusinessAndBranch(
    businessId: string,
    branchId: string,
    workScheduleId: string,
  ): Promise<boolean> {
    const schedule = await this.database.query.staffWorkSchedules.findFirst({
      where: and(
        eq(staffWorkSchedules.id, workScheduleId),
        eq(staffWorkSchedules.businessId, businessId),
        eq(staffWorkSchedules.branchId, branchId),
      ),
      columns: { id: true },
    });
    return Boolean(schedule);
  }

  // --- Branch Assignments ---

  async assignToBranch(
    businessId: string,
    staffMemberId: string,
    branchId: string,
    isPrimary = false,
  ): Promise<StaffBranchAssignment> {
    return this.database.transaction(async (tx) => {
      // ARCHITECTURE: Compare-And-Swap (CAS) Concurrency Guard
      // If setting a new primary branch, we must atomically clear the existing one.
      // We read the existing primary branch ID, then issue an UPDATE targeting THAT exact ID
      // and asserting `isPrimary = true`. If the update fails (0 rows), another request modified it first.
      if (isPrimary) {
        const currentPrimary = await tx.query.staffBranchAssignments.findFirst({
          where: and(
            eq(staffBranchAssignments.businessId, businessId),
            eq(staffBranchAssignments.staffMemberId, staffMemberId),
            eq(staffBranchAssignments.isPrimary, true),
            isNull(staffBranchAssignments.unassignedAt),
          ),
          columns: { id: true, branchId: true },
        });

        if (currentPrimary) {
          if (currentPrimary.branchId === branchId) {
            throw new ConflictError('Staff member is already assigned to this branch.');
          }

          const [updated] = await tx
            .update(staffBranchAssignments)
            .set({ isPrimary: false })
            .where(
              and(
                eq(staffBranchAssignments.id, currentPrimary.id),
                eq(staffBranchAssignments.isPrimary, true),
              ),
            )
            .returning({ id: staffBranchAssignments.id });

          if (!updated) {
            throw new Error('Concurrent modification detected: Primary branch state changed.');
          }
        }
      }

      // Check for existing assignment
      const existing = await tx.query.staffBranchAssignments.findFirst({
        where: and(
          eq(staffBranchAssignments.businessId, businessId),
          eq(staffBranchAssignments.staffMemberId, staffMemberId),
          eq(staffBranchAssignments.branchId, branchId),
        ),
      });

      if (existing) {
        // Active assignment: either promote it to primary, or reject the duplicate.
        if (existing.unassignedAt === null) {
          if (isPrimary && !existing.isPrimary) {
            const [promoted] = await tx
              .update(staffBranchAssignments)
              .set({ isPrimary: true })
              .where(
                and(
                  eq(staffBranchAssignments.id, existing.id),
                  isNull(staffBranchAssignments.unassignedAt),
                ),
              )
              .returning();

            if (!promoted) {
              throw new Error('Concurrent modification detected: Assignment state changed.');
            }

            return this.toAssignment(promoted);
          }

          throw new ConflictError('Staff member is already assigned to this branch.');
        }

        // ARCHITECTURE: Historical Reactivation & State Integrity
        // Instead of duplicating records (which could violate constraints or clutter data),
        // we reactivate the historical assignment using CAS. We assert against `unassignedAt`
        // to guarantee we only reactivate the exact state we just read.
        const [reactivated] = await tx
          .update(staffBranchAssignments)
          .set({ isPrimary, unassignedAt: null, assignedAt: new Date() })
          .where(
            and(
              eq(staffBranchAssignments.id, existing.id),
              // Compare-and-swap condition
              eq(staffBranchAssignments.unassignedAt, existing.unassignedAt),
            ),
          )
          .returning();

        if (!reactivated) {
          throw new Error('Concurrent modification detected: Assignment state changed.');
        }

        return this.toAssignment(reactivated);
      }

      const [inserted] = await tx
        .insert(staffBranchAssignments)
        .values({
          businessId,
          staffMemberId,
          branchId,
          isPrimary,
          assignedAt: new Date(),
          unassignedAt: null,
        })
        .returning();

      if (!inserted) {
        throw new Error('Failed to create branch assignment.');
      }

      return this.toAssignment(inserted);
    });
  }

  /**
   * Soft-unassigns a branch by timestamping `unassignedAt`.
   * Preserves historical assignment data for auditing rather than deleting the row.
   */
  async unassignFromBranch(
    businessId: string,
    staffMemberId: string,
    branchId: string,
  ): Promise<boolean> {
    const [updated] = await this.database
      .update(staffBranchAssignments)
      .set({ unassignedAt: new Date() })
      .where(
        and(
          eq(staffBranchAssignments.businessId, businessId),
          eq(staffBranchAssignments.staffMemberId, staffMemberId),
          eq(staffBranchAssignments.branchId, branchId),
          isNull(staffBranchAssignments.unassignedAt),
        ),
      )
      .returning({ id: staffBranchAssignments.id });

    return Boolean(updated);
  }

  async getBranchAssignments(
    businessId: string,
    staffMemberId: string,
  ): Promise<StaffBranchAssignment[]> {
    const rows = await this.database.query.staffBranchAssignments.findMany({
      where: and(
        eq(staffBranchAssignments.businessId, businessId),
        eq(staffBranchAssignments.staffMemberId, staffMemberId),
        isNull(staffBranchAssignments.unassignedAt),
      ),
    });

    return rows.map((r) => ({
      id: r.id,
      businessId: r.businessId,
      staffMemberId: r.staffMemberId,
      branchId: r.branchId,
      isPrimary: r.isPrimary,
      assignedAt: r.assignedAt,
      unassignedAt: r.unassignedAt,
    }));
  }

  // --- Service Assignments (staff_services) ---

  /**
   * Grants a staff member permission to perform a specific service.
   * Includes optional overrides (price, duration) unique to this specific staff member.
   * Duplicate assignments will result in a ConflictError.
   */
  async assignService(
    businessId: string,
    staffMemberId: string,
    serviceId: string,
    data?: {
      overridePrice?: string | null;
      overrideDurationMinutes?: number | null;
      isBookable?: boolean;
    },
  ): Promise<StaffServiceAssignment> {
    const [assignment] = await this.database
      .insert(staffServices)
      .values({
        businessId,
        staffMemberId,
        serviceId,
        overridePrice: data?.overridePrice ?? null,
        overrideDurationMinutes: data?.overrideDurationMinutes ?? null,
        isBookable: data?.isBookable ?? true,
      })
      .onConflictDoNothing({
        target: [staffServices.staffMemberId, staffServices.serviceId],
      })
      .returning();

    if (!assignment) {
      throw new ConflictError('This service is already assigned to the staff member.');
    }

    return {
      id: assignment.id,
      businessId: assignment.businessId,
      serviceId: assignment.serviceId,
      staffMemberId: assignment.staffMemberId,
      overridePrice: assignment.overridePrice,
      overrideDurationMinutes: assignment.overrideDurationMinutes,
      isBookable: assignment.isBookable,
    };
  }

  async unassignService(
    businessId: string,
    staffMemberId: string,
    serviceId: string,
  ): Promise<boolean> {
    const [deleted] = await this.database
      .delete(staffServices)
      .where(
        and(
          eq(staffServices.businessId, businessId),
          eq(staffServices.staffMemberId, staffMemberId),
          eq(staffServices.serviceId, serviceId),
        ),
      )
      .returning({ id: staffServices.id });

    return Boolean(deleted);
  }

  async getServiceAssignments(
    businessId: string,
    staffMemberId: string,
  ): Promise<StaffServiceAssignment[]> {
    const rows = await this.database.query.staffServices.findMany({
      where: and(
        eq(staffServices.businessId, businessId),
        eq(staffServices.staffMemberId, staffMemberId),
      ),
    });

    return rows.map((r) => ({
      id: r.id,
      businessId: r.businessId,
      serviceId: r.serviceId,
      staffMemberId: r.staffMemberId,
      overridePrice: r.overridePrice,
      overrideDurationMinutes: r.overrideDurationMinutes,
      isBookable: r.isBookable,
    }));
  }

  // --- Work Schedules & Shifts ---

  async createWorkSchedule(
    businessId: string,
    staffMemberId: string,
    branchId: string,
    data: {
      recurrencePattern: 'weekly' | 'biweekly' | 'triweekly' | 'four_weekly';
      effectiveFrom: string;
      effectiveUntil?: string | null;
    },
  ): Promise<StaffWorkSchedule> {
    return this.database.transaction(async (tx) => {
      // Retrieve any existing active schedule for this staff member at this branch
      const currentActive = await tx.query.staffWorkSchedules.findFirst({
        where: and(
          eq(staffWorkSchedules.businessId, businessId),
          eq(staffWorkSchedules.staffMemberId, staffMemberId),
          eq(staffWorkSchedules.branchId, branchId),
          isNull(staffWorkSchedules.effectiveUntil),
        ),
        columns: { id: true, effectiveFrom: true },
      });

      if (currentActive) {
        if (new Date(data.effectiveFrom) < new Date(currentActive.effectiveFrom)) {
          throw new ValidationError(
            'New schedule effectiveFrom cannot precede the current active schedule effectiveFrom',
            {
              effectiveFrom: 'Must be strictly after or equal to the current schedule start date',
            },
          );
        }
        // ARCHITECTURE: Schedule Replacement Atomic Transition
        // A staff member can only have ONE open-ended schedule per branch. To safely transition,
        // we use CAS to target the currently open schedule (`isNull(effectiveUntil)`).
        // By setting the new schedule's `effectiveFrom` as its end date, we mathematically
        // guarantee contiguous schedules without race conditions yielding multiple active records.
        const [updated] = await tx
          .update(staffWorkSchedules)
          .set({ effectiveUntil: data.effectiveFrom })
          .where(
            and(
              eq(staffWorkSchedules.id, currentActive.id),
              isNull(staffWorkSchedules.effectiveUntil),
            ),
          )
          .returning({ id: staffWorkSchedules.id });

        if (!updated) {
          throw new Error('Concurrent modification detected: Active schedule state changed.');
        }
      }

      const [schedule] = await tx
        .insert(staffWorkSchedules)
        .values({
          businessId,
          staffMemberId,
          branchId,
          recurrencePattern: data.recurrencePattern,
          effectiveFrom: data.effectiveFrom,
          effectiveUntil: data.effectiveUntil ?? null,
        })
        .returning();

      if (!schedule) {
        throw new Error('Failed to insert work schedule.');
      }

      return {
        id: schedule.id,
        businessId: schedule.businessId,
        staffMemberId: schedule.staffMemberId,
        branchId: schedule.branchId,
        recurrencePattern: schedule.recurrencePattern,
        effectiveFrom: schedule.effectiveFrom,
        effectiveUntil: schedule.effectiveUntil,
      };
    });
  }

  async addShiftToSchedule(
    workScheduleId: string,
    data: { dayOfWeek: number; startsAt: string; endsAt: string },
  ): Promise<StaffScheduleShift> {
    const [shift] = await this.database
      .insert(staffScheduleShifts)
      .values({
        workScheduleId,
        dayOfWeek: data.dayOfWeek,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
      })
      .returning();

    if (!shift) {
      throw new Error('Failed to insert schedule shift.');
    }

    return {
      id: shift.id,
      workScheduleId: shift.workScheduleId,
      dayOfWeek: shift.dayOfWeek,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
    };
  }

  async getWorkSchedules(
    businessId: string,
    staffMemberId: string,
    branchId?: string,
  ): Promise<(StaffWorkSchedule & { shifts: StaffScheduleShift[] })[]> {
    const schedules = await this.database.query.staffWorkSchedules.findMany({
      where: and(
        eq(staffWorkSchedules.businessId, businessId),
        eq(staffWorkSchedules.staffMemberId, staffMemberId),
        branchId ? eq(staffWorkSchedules.branchId, branchId) : undefined,
      ),
      with: {
        shifts: true,
      },
    });

    return schedules.map((s) => ({
      id: s.id,
      businessId: s.businessId,
      staffMemberId: s.staffMemberId,
      branchId: s.branchId,
      recurrencePattern: s.recurrencePattern,
      effectiveFrom: s.effectiveFrom,
      effectiveUntil: s.effectiveUntil,
      shifts: s.shifts.map((sh) => ({
        id: sh.id,
        workScheduleId: sh.workScheduleId,
        dayOfWeek: sh.dayOfWeek,
        startsAt: sh.startsAt,
        endsAt: sh.endsAt,
      })),
    }));
  }
}
