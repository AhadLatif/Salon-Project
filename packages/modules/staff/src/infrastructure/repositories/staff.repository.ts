import {
  branches,
  businessMembers,
  type db,
  services,
  staffBranchAssignments,
  staffMembers,
  staffScheduleShifts,
  staffServices,
  staffWorkSchedules,
} from '@salon/database';
import { ConflictError } from '@salon/shared';
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
   * Provisions a new Staff Profile.
   * Traps unique constraint violations to guarantee a human user (businessMember)
   * only ever has one active staff profile per salon.
   */
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
    } catch (error) {
      const err = error as { code?: string; constraint?: string };
      // A business member can only have ONE staff profile per business
      if (err.code === '23505' && err.constraint === 'uq_staff_business_member') {
        throw new ConflictError('This business member already has a staff profile.');
      }
      throw error;
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

    return !!deactivated;
  }

  // --- Security & Tenant Boundaries ---
  // These fast existence-checks verify that nested resources (branches, services, schedules)
  // actually belong to the authenticated business tenant to prevent Cross-Tenant IDOR attacks.

  async isBusinessMemberInBusiness(businessId: string, businessMemberId: string): Promise<boolean> {
    const member = await this.database.query.businessMembers.findFirst({
      where: and(
        eq(businessMembers.id, businessMemberId),
        eq(businessMembers.businessId, businessId),
      ),
      columns: { id: true },
    });
    return !!member;
  }

  async isBranchInBusiness(businessId: string, branchId: string): Promise<boolean> {
    const branch = await this.database.query.branches.findFirst({
      where: and(
        eq(branches.id, branchId),
        eq(branches.businessId, businessId),
        ne(branches.status, 'archived'),
      ),
      columns: { id: true },
    });
    return !!branch;
  }

  async isServiceInBusiness(businessId: string, serviceId: string): Promise<boolean> {
    const service = await this.database.query.services.findFirst({
      where: and(
        eq(services.id, serviceId),
        eq(services.businessId, businessId),
        eq(services.isActive, true),
      ),
      columns: { id: true },
    });
    return !!service;
  }

  async isWorkScheduleInBusiness(businessId: string, workScheduleId: string): Promise<boolean> {
    const schedule = await this.database.query.staffWorkSchedules.findFirst({
      where: and(
        eq(staffWorkSchedules.id, workScheduleId),
        eq(staffWorkSchedules.businessId, businessId),
      ),
      columns: { id: true },
    });
    return !!schedule;
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
          columns: { id: true },
        });

        if (currentPrimary) {
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
        if (existing.unassignedAt === null) {
          throw new ConflictError('Staff member is already assigned to this branch.');
        }

        // ARCHITECTURE: Historical Reactivation & State Integrity
        // Instead of duplicating records (which could violate constraints or clutter data),
        // we reactivate the historical assignment using CAS. We assert against `unassignedAt`
        // to guarantee we only reactivate the exact state we just read.
        const [reactivated] = await tx
          .update(staffBranchAssignments)
          .set({ isPrimary, unassignedAt: null })
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

        return {
          id: reactivated.id,
          businessId: reactivated.businessId,
          staffMemberId: reactivated.staffMemberId,
          branchId: reactivated.branchId,
          isPrimary: reactivated.isPrimary,
          assignedAt: reactivated.assignedAt,
          unassignedAt: reactivated.unassignedAt,
        };
      }

      const [inserted] = await tx
        .insert(staffBranchAssignments)
        .values({
          businessId,
          staffMemberId,
          branchId,
          isPrimary,
        })
        .returning();

      if (!inserted) {
        throw new Error('Failed to insert branch assignment.');
      }

      return {
        id: inserted.id,
        businessId: inserted.businessId,
        staffMemberId: inserted.staffMemberId,
        branchId: inserted.branchId,
        isPrimary: inserted.isPrimary,
        assignedAt: inserted.assignedAt,
        unassignedAt: inserted.unassignedAt,
      };
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

    return !!updated;
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
   * Uses `onConflictDoNothing` to silently ignore accidental duplicate assignments.
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

    return !!deleted;
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
    data: {
      recurrencePattern: 'weekly' | 'biweekly' | 'triweekly' | 'four_weekly';
      effectiveFrom: string;
      effectiveUntil?: string | null;
    },
  ): Promise<StaffWorkSchedule> {
    return this.database.transaction(async (tx) => {
      // Retrieve any existing active schedule
      const currentActive = await tx.query.staffWorkSchedules.findFirst({
        where: and(
          eq(staffWorkSchedules.businessId, businessId),
          eq(staffWorkSchedules.staffMemberId, staffMemberId),
          isNull(staffWorkSchedules.effectiveUntil),
        ),
        columns: { id: true },
      });

      if (currentActive) {
        // ARCHITECTURE: Schedule Replacement Atomic Transition
        // A staff member can only have ONE open-ended schedule. To safely transition,
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
  ): Promise<(StaffWorkSchedule & { shifts: StaffScheduleShift[] })[]> {
    const schedules = await this.database.query.staffWorkSchedules.findMany({
      where: and(
        eq(staffWorkSchedules.businessId, businessId),
        eq(staffWorkSchedules.staffMemberId, staffMemberId),
      ),
      with: {
        shifts: true,
      },
    });

    return schedules.map((s) => ({
      id: s.id,
      businessId: s.businessId,
      staffMemberId: s.staffMemberId,
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
