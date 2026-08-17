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

    const result = await useCase.execute(business.id, staff.id, {
      recurrencePattern: 'weekly',
      effectiveFrom: new Date('2025-01-01').toISOString(),
    });

    expect(result).toBeDefined();
    expect(result.staffMemberId).toBe(staff.id);
    expect(result.effectiveUntil).toBeNull();
    expect(result.recurrencePattern).toBe('weekly');
  });

  it('should throw ResourceNotFoundError when staff does not exist', async () => {
    const business = await createTestBusiness(db);

    await expect(
      useCase.execute(business.id, '00000000-0000-0000-0000-000000000000', {
        recurrencePattern: 'weekly',
        effectiveFrom: new Date('2025-01-01').toISOString(),
      }),
    ).rejects.toThrow(ResourceNotFoundError);
  });
});
