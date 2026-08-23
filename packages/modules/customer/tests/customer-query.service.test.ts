import { db } from '@salon/database';
import {
  createTestBusiness,
  createTestCustomer,
  createTestUser,
  truncateAllTables,
} from '@salon/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CustomerQueryService } from '../src/application/services/customer-query.service.js';
import { GetOrCreateCustomerForUserUseCase } from '../src/application/use-cases/get-or-create-customer-for-user.use-case.js';
import { CustomerRepository } from '../src/infrastructure/repositories/customer.repository.js';

describe('CustomerQueryService & GetOrCreateCustomerForUser Integration Tests', () => {
  let customerRepo: CustomerRepository;
  let queryService: CustomerQueryService;
  let getOrCreateUseCase: GetOrCreateCustomerForUserUseCase;

  beforeEach(async () => {
    await truncateAllTables(db);
    customerRepo = new CustomerRepository(db);
    queryService = new CustomerQueryService(customerRepo);
    getOrCreateUseCase = new GetOrCreateCustomerForUserUseCase(customerRepo);
  });

  it('isCustomerInBusiness should return true for active customer and false for archived or unknown customer', async () => {
    const business = await createTestBusiness(db);
    const activeCustomer = await createTestCustomer(db, business.id, {
      status: 'active',
    });
    const archivedCustomer = await createTestCustomer(db, business.id, {
      status: 'archived',
    });

    const isActive = await queryService.isCustomerInBusiness(business.id, activeCustomer.id);
    const isArchived = await queryService.isCustomerInBusiness(business.id, archivedCustomer.id);
    const isUnknown = await queryService.isCustomerInBusiness(
      business.id,
      '00000000-0000-0000-0000-000000000000',
    );

    expect(isActive).toBe(true);
    expect(isArchived).toBe(false);
    expect(isUnknown).toBe(false);
  });

  it('findCustomerByPhoneOrEmail should locate customer by email or phone number', async () => {
    const business = await createTestBusiness(db);
    const customer = await createTestCustomer(db, business.id, {
      email: 'searchme@example.com',
      phoneNumber: '+14155554321',
    });

    const byEmail = await queryService.findCustomerByPhoneOrEmail(business.id, {
      email: 'SEARCHME@EXAMPLE.COM',
    });
    const byPhone = await queryService.findCustomerByPhoneOrEmail(business.id, {
      phoneNumber: '+14155554321',
    });

    expect(byEmail?.id).toBe(customer.id);
    expect(byPhone?.id).toBe(customer.id);
  });

  it('GetOrCreateCustomerForUserUseCase should create new customer when not existing and return existing when present', async () => {
    const business = await createTestBusiness(db);
    const user = await createTestUser(db);

    // 1. Create on first encounter
    const customer1 = await getOrCreateUseCase.execute({
      businessId: business.id,
      userId: user.id,
      firstName: 'Jane',
      lastName: 'Marketplace',
      email: 'jane@marketplace.com',
    });

    expect(customer1).toBeDefined();
    expect(customer1.userId).toBe(user.id);
    expect(customer1.firstName).toBe('Jane');

    // 2. Return existing profile on subsequent calls
    const customer2 = await getOrCreateUseCase.execute({
      businessId: business.id,
      userId: user.id,
      firstName: 'Jane Updated',
    });

    expect(customer2.id).toBe(customer1.id);
  });
});
