import { db } from '@salon/database';
import { ConflictError, ForbiddenError } from '@salon/shared';
import { createTestBusiness, truncateAllTables } from '@salon/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateServiceUseCase } from '../src/application/use-cases/create-service.use-case.js';
import { ServiceRepository } from '../src/infrastructure/repositories/service.repository.js';
import { ServiceCategoryRepository } from '../src/infrastructure/repositories/service-category.repository.js';

describe('CreateServiceUseCase Integration Tests', () => {
  let categoryRepo: ServiceCategoryRepository;
  let serviceRepo: ServiceRepository;
  let useCase: CreateServiceUseCase;

  beforeEach(async () => {
    await truncateAllTables(db);
    categoryRepo = new ServiceCategoryRepository(db);
    serviceRepo = new ServiceRepository(db);
    useCase = new CreateServiceUseCase(serviceRepo, categoryRepo);
  });

  it('should successfully create a service in an active category', async () => {
    const business = await createTestBusiness(db);
    const category = await categoryRepo.create({
      businessId: business.id,
      name: 'Haircuts',
      displayOrder: 1,
    });

    const service = await useCase.execute({
      businessId: business.id,
      categoryId: category.id as string,
      name: 'Mens Haircut',
      defaultPrice: '30.00',
      defaultDurationMinutes: 30,
    });

    expect(service).toBeDefined();
    expect(service.name).toBe('Mens Haircut');
    expect(service.categoryId).toBe(category.id);
  });

  it('should throw ForbiddenError if category does not belong to business', async () => {
    const business1 = await createTestBusiness(db);
    const business2 = await createTestBusiness(db);

    const category = await categoryRepo.create({
      businessId: business2.id, // belongs to b2
      name: 'Haircuts',
      displayOrder: 1,
    });

    await expect(
      useCase.execute({
        businessId: business1.id, // creating in b1
        categoryId: category.id as string,
        name: 'Mens Haircut',
        defaultPrice: '30.00',
        defaultDurationMinutes: 30,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('should throw ConflictError if category is deactivated', async () => {
    const business = await createTestBusiness(db);
    const category = await categoryRepo.create({
      businessId: business.id,
      name: 'Haircuts',
      displayOrder: 1,
    });

    await categoryRepo.deactivate(business.id, category.id as string);

    await expect(
      useCase.execute({
        businessId: business.id,
        categoryId: category.id as string,
        name: 'Mens Haircut',
        defaultPrice: '30.00',
        defaultDurationMinutes: 30,
      }),
    ).rejects.toThrow(ConflictError);
  });
});
