import { randomUUID } from 'node:crypto';
// We don't have branch factory in testing yet, so we'll do raw insert for tests
import { branches, db } from '@salon/database';
import { ConflictError, ForbiddenError } from '@salon/shared';
import { createTestBusiness, truncateAllTables } from '@salon/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AssignServiceToBranchUseCase } from '../src/application/use-cases/assign-service-to-branch.use-case.js';
import { ServiceRepository } from '../src/infrastructure/repositories/service.repository.js';
import { ServiceCategoryRepository } from '../src/infrastructure/repositories/service-category.repository.js';

describe('AssignServiceToBranchUseCase Integration Tests', () => {
  let categoryRepo: ServiceCategoryRepository;
  let serviceRepo: ServiceRepository;
  let useCase: AssignServiceToBranchUseCase;

  beforeEach(async () => {
    await truncateAllTables(db);
    categoryRepo = new ServiceCategoryRepository(db);
    serviceRepo = new ServiceRepository(db);
    useCase = new AssignServiceToBranchUseCase(serviceRepo);
  });

  const createTestBranch = async (businessId: string, status: 'active' | 'archived' = 'active') => {
    const [branch] = await db
      .insert(branches)
      .values({
        id: randomUUID(),
        businessId,
        name: 'Test Branch',
        timezone: 'UTC',
        currency: 'USD',
        addressLine1: '123 Main',
        city: 'Test City',
        countryCode: 'US',
        status,
      })
      .returning();

    if (!branch) throw new Error('Failed to create test branch');

    return branch;
  };

  it('should assign a service to a branch successfully', async () => {
    const business = await createTestBusiness(db);
    const branch = await createTestBranch(business.id);
    const category = await categoryRepo.create({ businessId: business.id, name: 'Haircuts' });

    const service = await serviceRepo.create({
      businessId: business.id,
      categoryId: category.id as string,
      name: 'Mens Haircut',
      defaultPrice: '30.00',
      defaultDurationMinutes: 30,
    });

    await useCase.execute(business.id, service.id as string, branch.id);

    const assignments = await serviceRepo.getBranchAssignments(business.id, service.id as string);
    expect(assignments).toHaveLength(1);
    expect(assignments[0]).toMatchObject({
      branchId: branch.id,
      isBookable: true,
    });
  });

  it('should throw ForbiddenError if branch does not belong to business', async () => {
    const business1 = await createTestBusiness(db);
    const business2 = await createTestBusiness(db);
    const branchB2 = await createTestBranch(business2.id); // branch in b2
    const category = await categoryRepo.create({ businessId: business1.id, name: 'Haircuts' });

    const service = await serviceRepo.create({
      businessId: business1.id,
      categoryId: category.id as string,
      name: 'Mens Haircut',
      defaultPrice: '30.00',
      defaultDurationMinutes: 30,
    });

    await expect(useCase.execute(business1.id, service.id as string, branchB2.id)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('should throw ForbiddenError if branch is archived', async () => {
    const business = await createTestBusiness(db);
    const branch = await createTestBranch(business.id, 'archived');
    const category = await categoryRepo.create({ businessId: business.id, name: 'Haircuts' });

    const service = await serviceRepo.create({
      businessId: business.id,
      categoryId: category.id as string,
      name: 'Mens Haircut',
      defaultPrice: '30.00',
      defaultDurationMinutes: 30,
    });

    await expect(useCase.execute(business.id, service.id as string, branch.id)).rejects.toThrow(
      ForbiddenError,
    ); // isBranchValid returns false for archived
  });

  it('should throw ConflictError if service is inactive', async () => {
    const business = await createTestBusiness(db);
    const branch = await createTestBranch(business.id);
    const category = await categoryRepo.create({ businessId: business.id, name: 'Haircuts' });

    const service = await serviceRepo.create({
      businessId: business.id,
      categoryId: category.id as string,
      name: 'Mens Haircut',
      defaultPrice: '30.00',
      defaultDurationMinutes: 30,
    });

    await serviceRepo.deactivate(business.id, service.id as string);

    await expect(useCase.execute(business.id, service.id as string, branch.id)).rejects.toThrow(
      ConflictError,
    );
  });

  it('should throw ConflictError if already assigned', async () => {
    const business = await createTestBusiness(db);
    const branch = await createTestBranch(business.id);
    const category = await categoryRepo.create({ businessId: business.id, name: 'Haircuts' });

    const service = await serviceRepo.create({
      businessId: business.id,
      categoryId: category.id as string,
      name: 'Mens Haircut',
      defaultPrice: '30.00',
      defaultDurationMinutes: 30,
    });

    await useCase.execute(business.id, service.id as string, branch.id);

    await expect(useCase.execute(business.id, service.id as string, branch.id)).rejects.toThrow(
      ConflictError,
    );
  });

  it('should handle concurrent assignments without database constraint errors', async () => {
    const business = await createTestBusiness(db);
    const branch = await createTestBranch(business.id);
    const category = await categoryRepo.create({ businessId: business.id, name: 'Haircuts' });

    const service = await serviceRepo.create({
      businessId: business.id,
      categoryId: category.id as string,
      name: 'Mens Haircut',
      defaultPrice: '30.00',
      defaultDurationMinutes: 30,
    });

    // Run two assign operations concurrently
    const p1 = useCase.execute(business.id, service.id as string, branch.id);
    const p2 = useCase.execute(business.id, service.id as string, branch.id);

    const results = await Promise.allSettled([p1, p2]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly one should succeed, one should fail with ConflictError
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    if (rejected[0].status === 'rejected') {
      expect(rejected[0].reason).toBeInstanceOf(ConflictError);
    }
  });
});
