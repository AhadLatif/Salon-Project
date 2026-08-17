import { db } from '@salon/database';
import { ConflictError, ForbiddenError, ResourceNotFoundError } from '@salon/shared';
import {
  createTestBranch,
  createTestBusiness,
  createTestStaffMember,
  truncateAllTables,
} from '@salon/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AssignStaffToBranchUseCase } from '../src/application/use-cases/assign-staff-to-branch.use-case.js';
import { StaffRepository } from '../src/infrastructure/repositories/staff.repository.js';

describe('AssignStaffToBranchUseCase Integration Tests', () => {
  let repo: StaffRepository;
  let useCase: AssignStaffToBranchUseCase;

  beforeEach(async () => {
    await truncateAllTables(db);
    repo = new StaffRepository(db);
    useCase = new AssignStaffToBranchUseCase(repo);
  });

  it('should successfully assign staff to a branch', async () => {
    const business = await createTestBusiness(db);
    const staff = await createTestStaffMember(db, { businessId: business.id });
    const branch = await createTestBranch(db, { businessId: business.id });

    const result = await useCase.execute(business.id, staff.id, branch.id, true);

    expect(result).toBeDefined();
    expect(result.branchId).toBe(branch.id);
    expect(result.staffMemberId).toBe(staff.id);
    expect(result.isPrimary).toBe(true);
  });

  it('should throw ResourceNotFoundError when staff member does not exist', async () => {
    const business = await createTestBusiness(db);
    const branch = await createTestBranch(db, { businessId: business.id });

    await expect(
      useCase.execute(business.id, '00000000-0000-0000-0000-000000000000', branch.id, true),
    ).rejects.toThrow(ResourceNotFoundError);
  });

  it('should throw ForbiddenError (Tenant Isolation) when branch belongs to another business', async () => {
    const businessA = await createTestBusiness(db);
    const businessB = await createTestBusiness(db);
    const staff = await createTestStaffMember(db, { businessId: businessA.id });

    // Branch belongs to Business B, but we try to assign Staff from Business A
    const branchB = await createTestBranch(db, { businessId: businessB.id });

    await expect(useCase.execute(businessA.id, staff.id, branchB.id, true)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('should throw ConflictError if assignment already exists and is active', async () => {
    const business = await createTestBusiness(db);
    const staff = await createTestStaffMember(db, { businessId: business.id });
    const branch = await createTestBranch(db, { businessId: business.id });

    await useCase.execute(business.id, staff.id, branch.id, true);

    await expect(useCase.execute(business.id, staff.id, branch.id, true)).rejects.toThrow(
      ConflictError,
    );
  });
});
