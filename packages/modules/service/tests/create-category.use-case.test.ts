import { db } from '@salon/database';
import { ConflictError } from '@salon/shared';
import { createTestBusiness, truncateAllTables } from '@salon/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateCategoryUseCase } from '../src/application/use-cases/create-category.use-case.js';
import { ServiceCategoryRepository } from '../src/infrastructure/repositories/service-category.repository.js';

describe('CreateCategoryUseCase Integration Tests', () => {
  let categoryRepo: ServiceCategoryRepository;
  let useCase: CreateCategoryUseCase;

  beforeEach(async () => {
    await truncateAllTables(db);
    categoryRepo = new ServiceCategoryRepository(db);
    useCase = new CreateCategoryUseCase(categoryRepo);
  });

  it('should create a service category successfully', async () => {
    const business = await createTestBusiness(db);

    const category = await useCase.execute({
      businessId: business.id,
      name: 'Haircuts',
      description: 'All haircut services',
      displayOrder: 1,
    });

    expect(category).toBeDefined();
    expect(category.id).toBeDefined();
    expect(category.name).toBe('Haircuts');
    expect(category.businessId).toBe(business.id);
  });

  it('should throw ConflictError if category name already exists in business', async () => {
    const business = await createTestBusiness(db);

    await useCase.execute({
      businessId: business.id,
      name: 'Haircuts',
      displayOrder: 1,
    });

    await expect(
      useCase.execute({
        businessId: business.id,
        name: 'Haircuts',
        displayOrder: 2,
      }),
    ).rejects.toThrow(ConflictError);
  });
});
