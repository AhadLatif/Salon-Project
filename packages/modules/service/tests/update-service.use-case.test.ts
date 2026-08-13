import { db } from '@salon/database';
import { ConflictError, ForbiddenError, ResourceNotFoundError } from '@salon/shared';
import { createTestBusiness, truncateAllTables } from '@salon/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UpdateServiceUseCase } from '../src/application/use-cases/update-service.use-case.js';
import { ServiceRepository } from '../src/infrastructure/repositories/service.repository.js';
import { ServiceCategoryRepository } from '../src/infrastructure/repositories/service-category.repository.js';

describe('UpdateServiceUseCase Integration Tests', () => {
  let categoryRepo: ServiceCategoryRepository;
  let serviceRepo: ServiceRepository;
  let useCase: UpdateServiceUseCase;

  beforeEach(async () => {
    await truncateAllTables(db);
    categoryRepo = new ServiceCategoryRepository(db);
    serviceRepo = new ServiceRepository(db);
    useCase = new UpdateServiceUseCase(serviceRepo, categoryRepo);
  });

  it('should successfully update a service', async () => {
    const business = await createTestBusiness(db);
    const category = await categoryRepo.create({
      businessId: business.id,
      name: 'Haircuts',
      displayOrder: 1,
    });

    const service = await serviceRepo.create({
      businessId: business.id,
      categoryId: category.id as string,
      name: 'Mens Haircut',
      defaultPrice: '30.00',
      defaultDurationMinutes: 30,
    });

    const updated = await useCase.execute(business.id, service.id as string, {
      name: 'Mens Haircut Premium',
      defaultPrice: '40.00',
    });

    expect(updated).toBeDefined();
    expect(updated.name).toBe('Mens Haircut Premium');
    expect(updated.defaultPrice).toBe('40.00');
    // Unchanged
    expect(updated.defaultDurationMinutes).toBe(30);
  });

  it('should throw ResourceNotFoundError if service does not exist', async () => {
    const business = await createTestBusiness(db);

    await expect(
      useCase.execute(business.id, '00000000-0000-0000-0000-000000000000', {
        name: 'New Name',
      }),
    ).rejects.toThrow(ResourceNotFoundError);
  });

  it('should successfully change category if target category is active', async () => {
    const business = await createTestBusiness(db);
    const category1 = await categoryRepo.create({ businessId: business.id, name: 'C1' });
    const category2 = await categoryRepo.create({ businessId: business.id, name: 'C2' });

    const service = await serviceRepo.create({
      businessId: business.id,
      categoryId: category1.id as string,
      name: 'Mens Haircut',
      defaultPrice: '30.00',
      defaultDurationMinutes: 30,
    });

    const updated = await useCase.execute(business.id, service.id as string, {
      categoryId: category2.id as string,
    });

    expect(updated.categoryId).toBe(category2.id);
  });

  it('should throw ForbiddenError if moving to category of another business', async () => {
    const business1 = await createTestBusiness(db);
    const business2 = await createTestBusiness(db);
    const category1 = await categoryRepo.create({ businessId: business1.id, name: 'C1' });
    const category2 = await categoryRepo.create({ businessId: business2.id, name: 'C2' }); // b2

    const service = await serviceRepo.create({
      businessId: business1.id,
      categoryId: category1.id as string,
      name: 'Mens Haircut',
      defaultPrice: '30.00',
      defaultDurationMinutes: 30,
    });

    await expect(
      useCase.execute(business1.id, service.id as string, {
        categoryId: category2.id as string,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('should throw ConflictError if moving to inactive category', async () => {
    const business = await createTestBusiness(db);
    const category1 = await categoryRepo.create({ businessId: business.id, name: 'C1' });
    const category2 = await categoryRepo.create({ businessId: business.id, name: 'C2' });

    await categoryRepo.deactivate(business.id, category2.id as string);

    const service = await serviceRepo.create({
      businessId: business.id,
      categoryId: category1.id as string,
      name: 'Mens Haircut',
      defaultPrice: '30.00',
      defaultDurationMinutes: 30,
    });

    await expect(
      useCase.execute(business.id, service.id as string, {
        categoryId: category2.id as string,
      }),
    ).rejects.toThrow(ConflictError);
  });
});
