import { db } from '@salon/database';
import { ConflictError, ValidationError } from '@salon/shared';
import { createTestBusiness, truncateAllTables } from '@salon/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateCustomerUseCase } from '../src/application/use-cases/create-customer.use-case.js';
import { CustomerRepository } from '../src/infrastructure/repositories/customer.repository.js';

describe('CreateCustomerUseCase Integration Tests', () => {
  let customerRepo: CustomerRepository;
  let useCase: CreateCustomerUseCase;

  beforeEach(async () => {
    await truncateAllTables(db);
    customerRepo = new CustomerRepository(db);
    useCase = new CreateCustomerUseCase(customerRepo);
  });

  it('should successfully create a customer profile with full details', async () => {
    const business = await createTestBusiness(db);

    const customer = await useCase.execute({
      businessId: business.id,
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'ALICE.SMITH@example.com',
      phoneNumber: '+14155552671',
      gender: 'female',
      dateOfBirth: '1995-06-15',
      marketingOptIn: true,
    });

    expect(customer).toBeDefined();
    expect(customer.id).toBeDefined();
    expect(customer.businessId).toBe(business.id);
    expect(customer.firstName).toBe('Alice');
    expect(customer.lastName).toBe('Smith');
    expect(customer.email).toBe('alice.smith@example.com'); // normalized lowercase
    expect(customer.phoneNumber).toBe('+14155552671');
    expect(customer.gender).toBe('female');
    expect(customer.status).toBe('active');
    expect(customer.marketingOptIn).toBe(true);
  });

  it('should successfully create a walk-in guest with only a phone number', async () => {
    const business = await createTestBusiness(db);

    const customer = await useCase.execute({
      businessId: business.id,
      firstName: 'WalkIn',
      phoneNumber: '+14155559999',
    });

    expect(customer).toBeDefined();
    expect(customer.email).toBeNull();
    expect(customer.phoneNumber).toBe('+14155559999');
    expect(customer.status).toBe('active');
  });

  it('should throw ValidationError if neither email nor phone number is provided (contact invariant)', async () => {
    const business = await createTestBusiness(db);

    await expect(
      useCase.execute({
        businessId: business.id,
        firstName: 'Ghost Customer',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ConflictError if duplicate email is registered within the same business (case-insensitive)', async () => {
    const business = await createTestBusiness(db);

    await useCase.execute({
      businessId: business.id,
      firstName: 'Alice',
      email: 'duplicate@example.com',
    });

    await expect(
      useCase.execute({
        businessId: business.id,
        firstName: 'Alice Clone',
        email: 'DUPLICATE@example.com',
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('should allow identical email in DIFFERENT salon businesses (multi-tenant boundary)', async () => {
    const businessA = await createTestBusiness(db);
    const businessB = await createTestBusiness(db);

    const customerA = await useCase.execute({
      businessId: businessA.id,
      firstName: 'MultiSalon Alice',
      email: 'client@example.com',
    });

    const customerB = await useCase.execute({
      businessId: businessB.id,
      firstName: 'MultiSalon Alice',
      email: 'client@example.com',
    });

    expect(customerA.id).not.toBe(customerB.id);
    expect(customerA.businessId).toBe(businessA.id);
    expect(customerB.businessId).toBe(businessB.id);
  });
});
