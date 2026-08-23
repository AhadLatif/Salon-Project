import { db } from '@salon/database';
import { ConflictError, ResourceNotFoundError, ValidationError } from '@salon/shared';
import { createTestBusiness, createTestCustomer, truncateAllTables } from '@salon/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UpdateCustomerUseCase } from '../src/application/use-cases/update-customer.use-case.js';
import { CustomerRepository } from '../src/infrastructure/repositories/customer.repository.js';

describe('UpdateCustomerUseCase Integration Tests', () => {
  let customerRepo: CustomerRepository;
  let useCase: UpdateCustomerUseCase;

  beforeEach(async () => {
    await truncateAllTables(db);
    customerRepo = new CustomerRepository(db);
    useCase = new UpdateCustomerUseCase(customerRepo);
  });

  it('should successfully update customer profile details', async () => {
    const business = await createTestBusiness(db);
    const customer = await createTestCustomer(db, business.id, {
      firstName: 'OldName',
      email: 'old@example.com',
      phoneNumber: '+14155551111',
    });

    const updated = await useCase.execute(business.id, customer.id, {
      firstName: 'NewName',
      phoneNumber: '+14155552222',
      marketingOptIn: true,
    });

    expect(updated.firstName).toBe('NewName');
    expect(updated.phoneNumber).toBe('+14155552222');
    expect(updated.email).toBe('old@example.com'); // retained
    expect(updated.marketingOptIn).toBe(true);
  });

  it('should throw ValidationError when update removes the last remaining contact method', async () => {
    const business = await createTestBusiness(db);
    // Customer has only an email, no phone
    const customer = await createTestCustomer(db, business.id, {
      firstName: 'EmailOnly',
      email: 'emailonly@example.com',
      phoneNumber: null,
    });

    // Attempt to set email to null without providing a phone number
    await expect(
      useCase.execute(business.id, customer.id, {
        email: null,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ConflictError when changing email to one used by another customer in the business', async () => {
    const business = await createTestBusiness(db);
    await createTestCustomer(db, business.id, {
      firstName: 'Alice',
      email: 'alice@example.com',
    });
    const bob = await createTestCustomer(db, business.id, {
      firstName: 'Bob',
      email: 'bob@example.com',
    });

    await expect(
      useCase.execute(business.id, bob.id, {
        email: 'alice@example.com',
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('should allow customer to update other fields while keeping same email', async () => {
    const business = await createTestBusiness(db);
    const customer = await createTestCustomer(db, business.id, {
      firstName: 'Charlie',
      email: 'charlie@example.com',
    });

    const updated = await useCase.execute(business.id, customer.id, {
      firstName: 'Charles',
      email: 'charlie@example.com',
    });

    expect(updated.firstName).toBe('Charles');
    expect(updated.email).toBe('charlie@example.com');
  });

  it('should throw ConflictError when attempting to update an archived customer', async () => {
    const business = await createTestBusiness(db);
    const customer = await createTestCustomer(db, business.id, {
      status: 'archived',
    });

    await expect(
      useCase.execute(business.id, customer.id, {
        firstName: 'TryUpdate',
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('should throw ResourceNotFoundError when customer does not exist in business', async () => {
    const business = await createTestBusiness(db);

    await expect(
      useCase.execute(business.id, '00000000-0000-0000-0000-000000000000', {
        firstName: 'Ghost',
      }),
    ).rejects.toThrow(ResourceNotFoundError);
  });
});
