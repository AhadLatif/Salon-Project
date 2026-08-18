import { db } from '@salon/database';
import { ConflictError } from '@salon/shared';
import {
  createTestBranch,
  createTestBusiness,
  createTestBusinessMember,
  createTestService,
  createTestStaffMember,
  truncateAllTables,
} from '@salon/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { StaffRepository } from '../src/infrastructure/repositories/staff.repository.js';

describe('StaffRepository Integration Tests', () => {
  let repository: StaffRepository;

  beforeEach(async () => {
    await truncateAllTables(db);
    repository = new StaffRepository(db);
  });

  describe('CRUD Operations', () => {
    it('should create a staff member successfully', async () => {
      const business = await createTestBusiness(db);
      const member = await createTestBusinessMember(db, { businessId: business.id });

      const staff = await repository.create({
        businessId: business.id,
        businessMemberId: member.id,
        displayName: 'John Doe',
        jobTitle: 'Senior Barber',
        employmentType: 'full_time',
        excludeFromAutoAssignment: false,
      });

      expect(staff).toBeDefined();
      expect(staff.id).toBeDefined();
      expect(staff.businessId).toBe(business.id);
      expect(staff.displayName).toBe('John Doe');
      expect(staff.status).toBe('active');
    });

    it('should throw Error (DB Constraint) on duplicate businessMember per business', async () => {
      const business = await createTestBusiness(db);
      const member = await createTestBusinessMember(db, { businessId: business.id });

      await repository.create({
        businessId: business.id,
        businessMemberId: member.id,
        displayName: 'John Doe',
      });

      // A single businessMember can only be a staff once in a business
      await expect(
        repository.create({
          businessId: business.id,
          businessMemberId: member.id,
          displayName: 'Duplicate John',
        }),
      ).rejects.toThrow();
    });

    it('should find active staff by ID', async () => {
      const business = await createTestBusiness(db);
      const staff = await createTestStaffMember(db, { businessId: business.id });

      const result = await repository.findById(business.id, staff.id);
      expect(result).toBeDefined();
      expect(result?.id).toBe(staff.id);
    });

    it('should return null if searching in wrong tenant', async () => {
      const b1 = await createTestBusiness(db);
      const b2 = await createTestBusiness(db);
      const staff = await createTestStaffMember(db, { businessId: b1.id });

      const result = await repository.findById(b2.id, staff.id);
      expect(result).toBeNull();
    });

    it('should deactivate a staff member', async () => {
      const business = await createTestBusiness(db);
      const staff = await createTestStaffMember(db, { businessId: business.id });

      const deactivated = await repository.deactivate(business.id, staff.id);
      expect(deactivated).toBe(true);

      const result = await repository.findById(business.id, staff.id);
      expect(result).toBeNull(); // Soft delete makes findById return null
    });
  });

  describe('Branch Assignments (CAS logic)', () => {
    it('should assign a staff to a branch and toggle primary status atomically', async () => {
      const business = await createTestBusiness(db);
      const branch1 = await createTestBranch(db, { businessId: business.id });
      const branch2 = await createTestBranch(db, { businessId: business.id });
      const staff = await createTestStaffMember(db, { businessId: business.id });

      // Assign to branch 1 as primary
      await repository.assignToBranch(business.id, staff.id, branch1.id, true);

      let assignments = await repository.getBranchAssignments(business.id, staff.id);
      expect(assignments).toHaveLength(1);
      expect(assignments[0].branchId).toBe(branch1.id);
      expect(assignments[0].isPrimary).toBe(true);

      // Assign to branch 2 as primary (this should automatically make branch 1 non-primary)
      await repository.assignToBranch(business.id, staff.id, branch2.id, true);

      assignments = await repository.getBranchAssignments(business.id, staff.id);
      expect(assignments).toHaveLength(2);

      const b1Assignment = assignments.find((a) => a.branchId === branch1.id);
      const b2Assignment = assignments.find((a) => a.branchId === branch2.id);

      expect(b2Assignment?.isPrimary).toBe(true);
      expect(b1Assignment?.isPrimary).toBe(false);
    });

    it('should throw ConflictError if assignment already active', async () => {
      const business = await createTestBusiness(db);
      const branch = await createTestBranch(db, { businessId: business.id });
      const staff = await createTestStaffMember(db, { businessId: business.id });

      await repository.assignToBranch(business.id, staff.id, branch.id, true);

      await expect(
        repository.assignToBranch(business.id, staff.id, branch.id, true),
      ).rejects.toThrow(ConflictError);
    });

    it('should reactivate a previously unassigned branch assignment', async () => {
      const business = await createTestBusiness(db);
      const branch = await createTestBranch(db, { businessId: business.id });
      const staff = await createTestStaffMember(db, { businessId: business.id });

      await repository.assignToBranch(business.id, staff.id, branch.id, false);
      await repository.unassignFromBranch(business.id, staff.id, branch.id);

      let assignments = await repository.getBranchAssignments(business.id, staff.id);
      expect(assignments).toHaveLength(0); // active only

      // Reactivate
      await repository.assignToBranch(business.id, staff.id, branch.id, true);
      assignments = await repository.getBranchAssignments(business.id, staff.id);
      expect(assignments).toHaveLength(1);
      expect(assignments[0].isPrimary).toBe(true);
    });

    it('should prevent multiple primary assignments via concurrent execution (CAS logic)', async () => {
      const business = await createTestBusiness(db);
      const branch1 = await createTestBranch(db, { businessId: business.id });
      const branch2 = await createTestBranch(db, { businessId: business.id });
      const staff = await createTestStaffMember(db, { businessId: business.id });

      // Simulate concurrent assignments for both branches as primary
      await Promise.allSettled([
        repository.assignToBranch(business.id, staff.id, branch1.id, true),
        repository.assignToBranch(business.id, staff.id, branch2.id, true),
      ]);

      const assignments = await repository.getBranchAssignments(business.id, staff.id);
      expect(assignments.length).toBeGreaterThan(0);
      const primaryCount = assignments.filter((a) => a.isPrimary).length;
      expect(primaryCount).toBe(1);
    });
  });

  describe('Service Assignments', () => {
    it('should assign a service to a staff member successfully', async () => {
      const business = await createTestBusiness(db);
      const staff = await createTestStaffMember(db, { businessId: business.id });
      const service = await createTestService(db, { businessId: business.id });

      await repository.assignService(business.id, staff.id, service.id);

      const assignments = await repository.getServiceAssignments(business.id, staff.id);
      expect(assignments).toHaveLength(1);
      expect(assignments[0].serviceId).toBe(service.id);
    });
  });

  describe('Work Schedules (CAS Logic)', () => {
    it('should automatically close previous schedule when a new open-ended one is created', async () => {
      const business = await createTestBusiness(db);
      const staff = await createTestStaffMember(db, { businessId: business.id });
      const branch = await createTestBranch(db, { businessId: business.id });

      const schedule1 = {
        recurrencePattern: 'weekly' as const,
        effectiveFrom: new Date('2023-01-01').toISOString(),
      };

      await repository.createWorkSchedule(business.id, staff.id, branch.id, schedule1);

      let schedules = await repository.getWorkSchedules(business.id, staff.id);
      expect(schedules).toHaveLength(1);
      expect(schedules[0].effectiveUntil).toBeNull();

      // Create a second schedule
      const effectiveFrom2 = new Date('2023-06-01');
      const schedule2 = {
        recurrencePattern: 'weekly' as const,
        effectiveFrom: effectiveFrom2.toISOString(),
      };

      await repository.createWorkSchedule(business.id, staff.id, branch.id, schedule2);

      schedules = await repository.getWorkSchedules(business.id, staff.id);
      expect(schedules).toHaveLength(2);

      // Verify the first schedule was closed atomically using the CAS logic (effectiveUntil = schedule2.effectiveFrom)
      const oldSchedule = schedules.find(
        (s) => new Date(s.effectiveFrom).toISOString() === new Date('2023-01-01').toISOString(),
      );
      const newSchedule = schedules.find(
        (s) => new Date(s.effectiveFrom).toISOString() === effectiveFrom2.toISOString(),
      );

      expect(newSchedule?.effectiveUntil).toBeNull();
      expect(
        oldSchedule?.effectiveUntil ? new Date(oldSchedule.effectiveUntil).toISOString() : null,
      ).toBe(effectiveFrom2.toISOString());
    });

    it('should prevent multiple open-ended schedules via concurrent creation (CAS logic)', async () => {
      const business = await createTestBusiness(db);
      const staff = await createTestStaffMember(db, { businessId: business.id });
      const branch = await createTestBranch(db, { businessId: business.id });

      const schedule1 = {
        recurrencePattern: 'weekly' as const,
        effectiveFrom: new Date('2025-01-01').toISOString(),
      };
      const schedule2 = {
        recurrencePattern: 'weekly' as const,
        effectiveFrom: new Date('2025-02-01').toISOString(),
      };

      await Promise.allSettled([
        repository.createWorkSchedule(business.id, staff.id, branch.id, schedule1),
        repository.createWorkSchedule(business.id, staff.id, branch.id, schedule2),
      ]);

      const schedules = await repository.getWorkSchedules(business.id, staff.id);
      expect(schedules.length).toBeGreaterThan(0);
      const openEndedCount = schedules.filter((s) => s.effectiveUntil === null).length;
      expect(openEndedCount).toBe(1);
    });
  });
});
