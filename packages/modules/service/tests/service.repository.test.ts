import { db } from '@salon/database';
import { ConflictError } from '@salon/shared';
import { createTestBusiness, truncateAllTables } from '@salon/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ServiceRepository } from '../src/infrastructure/repositories/service.repository.js';
import { ServiceCategoryRepository } from '../src/infrastructure/repositories/service-category.repository.js';

describe('ServiceRepository Integration Tests', () => {
  let categoryRepo: ServiceCategoryRepository;
  let serviceRepo: ServiceRepository;

  beforeEach(async () => {
    await truncateAllTables(db);
    categoryRepo = new ServiceCategoryRepository(db);
    serviceRepo = new ServiceRepository(db);
  });

  it('should create a service successfully', async () => {
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

    expect(service).toBeDefined();
    expect(service.name).toBe('Mens Haircut');
    expect(service.categoryId).toBe(category.id);
    expect(service.defaultPrice).toBe('30.00');
    expect(service.isActive).toBe(true);
  });

  it('should throw ConflictError if service name already exists in business', async () => {
    const business = await createTestBusiness(db);
    const category = await categoryRepo.create({
      businessId: business.id,
      name: 'Haircuts',
      displayOrder: 1,
    });

    await serviceRepo.create({
      businessId: business.id,
      categoryId: category.id as string,
      name: 'Mens Haircut',
      defaultPrice: '30.00',
      defaultDurationMinutes: 30,
    });

    await expect(
      serviceRepo.create({
        businessId: business.id,
        categoryId: category.id as string,
        name: 'Mens Haircut',
        defaultPrice: '40.00',
        defaultDurationMinutes: 45,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('should filter inactive services when fetching by ID', async () => {
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

    await serviceRepo.deactivate(business.id, service.id as string);

    const fetchedNull = await serviceRepo.findById(business.id, service.id as string);
    expect(fetchedNull).toBeNull();

    const fetchedActive = await serviceRepo.findById(business.id, service.id as string, {
      includeInactive: true,
    });
    expect(fetchedActive).toBeDefined();
    expect(fetchedActive?.isActive).toBe(false);
  });
});
