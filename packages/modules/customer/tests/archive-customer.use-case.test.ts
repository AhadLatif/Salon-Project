import { db } from '@salon/database';
import { ConflictError, ResourceNotFoundError } from '@salon/shared';
import { createTestBusiness, createTestCustomer, truncateAllTables } from '@salon/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ArchiveCustomerUseCase } from '../src/application/use-cases/archive-customer.use-case.js';
import { CustomerRepository } from '../src/infrastructure/repositories/customer.repository.js';

describe('ArchiveCustomerUseCase Integration Tests', () => {
  let customerRepo: CustomerRepository;
  let useCase: ArchiveCustomerUseCase;

  beforeEach(async () => {
    await truncateAllTables(db);
    customerRepo = new CustomerRepository(db);
    useCase = new ArchiveCustomerUseCase(customerRepo);
  });

  it('should successfully soft-archive an active customer', async () => {
    const business = await createTestBusiness(db);
    const customer = await createTestCustomer(db, business.id, {
      status: 'active',
    });

    const archived = await useCase.execute(business.id, customer.id);

    expect(archived).toBeDefined();
    expect(archived.id).toBe(customer.id);
    expect(archived.status).toBe('archived');

    // Verify DB state
    const fromDb = await customerRepo.findById(business.id, customer.id);
    expect(fromDb?.status).toBe('archived');
  });

  it('should throw ConflictError when customer is already archived', async () => {
    const business = await createTestBusiness(db);
    const customer = await createTestCustomer(db, business.id, {
      status: 'archived',
    });

    await expect(useCase.execute(business.id, customer.id)).rejects.toThrow(ConflictError);
  });

  it('should throw ResourceNotFoundError when customer does not exist', async () => {
    const business = await createTestBusiness(db);

    await expect(
      useCase.execute(business.id, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow(ResourceNotFoundError);
  });
});
