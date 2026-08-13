import { db } from '@salon/database';
import { ConflictError } from '@salon/shared';
import { createTestBusiness, truncateAllTables } from '@salon/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ServiceCategoryRepository } from '../src/infrastructure/repositories/service-category.repository.js';

describe('ServiceCategoryRepository Integration Tests', () => {
  let repository: ServiceCategoryRepository;

  beforeEach(async () => {
    await truncateAllTables(db);
    repository = new ServiceCategoryRepository(db);
  });

  it('should create a service category successfully', async () => {
    const business = await createTestBusiness(db);

    const category = await repository.create({
      businessId: business.id,
      name: 'Haircuts',
      description: 'All haircut services',
      displayOrder: 1,
    });

    expect(category).toBeDefined();
    expect(category.id).toBeDefined();
    expect(category.name).toBe('Haircuts');
    expect(category.businessId).toBe(business.id);
    expect(category.isActive).toBe(true);
  });

  it('should throw ConflictError if category name already exists in business', async () => {
    const business = await createTestBusiness(db);

    await repository.create({
      businessId: business.id,
      name: 'Haircuts',
      displayOrder: 1,
    });

    await expect(
      repository.create({
        businessId: business.id,
        name: 'Haircuts',
        displayOrder: 2,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('should fetch category by ID and filter inactive correctly', async () => {
    const business = await createTestBusiness(db);

    const category = await repository.create({
      businessId: business.id,
      name: 'Haircuts',
      displayOrder: 1,
    });

    // Fetch active
    const fetched = await repository.findById(business.id, category.id as string);
    expect(fetched).toBeDefined();
    expect(fetched?.name).toBe('Haircuts');

    // Deactivate
    await repository.deactivate(business.id, category.id as string);

    // Fetch without includeInactive should be null
    const fetchedInactiveNull = await repository.findById(business.id, category.id as string);
    expect(fetchedInactiveNull).toBeNull();

    // Fetch with includeInactive should return
    const fetchedInactive = await repository.findById(business.id, category.id as string, {
      includeInactive: true,
    });
    expect(fetchedInactive).toBeDefined();
    expect(fetchedInactive?.isActive).toBe(false);
  });
});
