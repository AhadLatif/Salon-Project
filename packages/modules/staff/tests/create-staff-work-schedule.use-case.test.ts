import { db } from '@salon/database';
import { ResourceNotFoundError } from '@salon/shared';
import {
  createTestBranch,
  createTestBusiness,
  createTestStaffMember,
  truncateAllTables,
} from '@salon/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateStaffWorkScheduleUseCase } from '../src/application/use-cases/create-staff-work-schedule.use-case.js';
import { StaffRepository } from '../src/infrastructure/repositories/staff.repository.js';

describe('CreateStaffWorkScheduleUseCase Integration Tests', () => {
  let repo: StaffRepository;
  let useCase: CreateStaffWorkScheduleUseCase;

  beforeEach(async () => {
    await truncateAllTables(db);
    repo = new StaffRepository(db);
    useCase = new CreateStaffWorkScheduleUseCase(repo);
  });

  it('should successfully create a work schedule for a staff member', async () => {
    const business = await createTestBusiness(db);
    const staff = await createTestStaffMember(db, { businessId: business.id });
    const branch = await createTestBranch(db, { businessId: business.id });

    // First assign staff to branch
    await repo.assignToBranch(business.id, staff.id, branch.id, true);

    const result = await useCase.execute(business.id, staff.id, branch.id, {
      recurrencePattern: 'weekly',
      effectiveFrom: new Date('2025-01-01').toISOString(),
    });

    expect(result).toBeDefined();
    expect(result.staffMemberId).toBe(staff.id);
    expect(result.branchId).toBe(branch.id);
    expect(result.effectiveUntil).toBeNull();
    expect(result.recurrencePattern).toBe('weekly');
  });

  it('should throw ResourceNotFoundError when staff does not exist', async () => {
    const business = await createTestBusiness(db);
    const branch = await createTestBranch(db, { businessId: business.id });

    await expect(
      useCase.execute(business.id, '00000000-0000-0000-0000-000000000000', branch.id, {
        recurrencePattern: 'weekly',
        effectiveFrom: new Date('2025-01-01').toISOString(),
      }),
    ).rejects.toThrow(ResourceNotFoundError);
  });

  it('should throw ResourceNotFoundError when branch does not belong to the business', async () => {
    const business = await createTestBusiness(db);
    const staff = await createTestStaffMember(db, { businessId: business.id });
    const otherBusiness = await createTestBusiness(db);
    const otherBranch = await createTestBranch(db, { businessId: otherBusiness.id });

    await expect(
      useCase.execute(business.id, staff.id, otherBranch.id, {
        recurrencePattern: 'weekly',
        effectiveFrom: new Date('2025-01-01').toISOString(),
      }),
    ).rejects.toThrow(ResourceNotFoundError);
  });

  it('should enforce one open schedule per staff per branch (replace existing)', async () => {
    const business = await createTestBusiness(db);
    const staff = await createTestStaffMember(db, { businessId: business.id });
    const branch = await createTestBranch(db, { businessId: business.id });

    await repo.assignToBranch(business.id, staff.id, branch.id, true);

    // Create first schedule
    const first = await useCase.execute(business.id, staff.id, branch.id, {
      recurrencePattern: 'weekly',
      effectiveFrom: new Date('2025-01-01').toISOString(),
    });

    expect(first.effectiveUntil).toBeNull();

    // Create second schedule - should close the first
    const second = await useCase.execute(business.id, staff.id, branch.id, {
      recurrencePattern: 'weekly',
      effectiveFrom: new Date('2025-02-01').toISOString(),
    });

    expect(second.effectiveUntil).toBeNull();

    // The first schedule should now be closed
    const schedules = await repo.getWorkSchedules(business.id, staff.id);
    const branchSchedules = schedules.filter((s) => s.branchId === branch.id);
    expect(branchSchedules).toHaveLength(2);
    const closed = branchSchedules.find((s) => s.id === first.id);
    expect(closed?.effectiveUntil).toBeDefined();
  });

  it('should allow different schedules for different branches', async () => {
    const business = await createTestBusiness(db);
    const staff = await createTestStaffMember(db, { businessId: business.id });
    const branchA = await createTestBranch(db, { businessId: business.id });
    const branchB = await createTestBranch(db, { businessId: business.id });

    await repo.assignToBranch(business.id, staff.id, branchA.id, true);
    await repo.assignToBranch(business.id, staff.id, branchB.id, false);

    const scheduleA = await useCase.execute(business.id, staff.id, branchA.id, {
      recurrencePattern: 'weekly',
      effectiveFrom: new Date('2025-01-01').toISOString(),
    });

    const scheduleB = await useCase.execute(business.id, staff.id, branchB.id, {
      recurrencePattern: 'biweekly',
      effectiveFrom: new Date('2025-01-01').toISOString(),
    });

    expect(scheduleA.branchId).toBe(branchA.id);
    expect(scheduleB.branchId).toBe(branchB.id);

    const schedules = await repo.getWorkSchedules(business.id, staff.id);
    expect(schedules).toHaveLength(2);
  });
});
