import { db } from '@salon/database';
import { ConflictError, ResourceNotFoundError } from '@salon/shared';
import {
  createTestBusiness,
  createTestBusinessMember,
  createTestCustomer,
  truncateAllTables,
} from '@salon/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AssignCustomerTagUseCase } from '../src/application/use-cases/assign-customer-tag.use-case.js';
import { CreateCustomerTagUseCase } from '../src/application/use-cases/create-customer-tag.use-case.js';
import { DeleteCustomerTagUseCase } from '../src/application/use-cases/delete-customer-tag.use-case.js';
import { GetCustomerDetailsUseCase } from '../src/application/use-cases/get-customer-details.use-case.js';
import { GetCustomerTagsUseCase } from '../src/application/use-cases/get-customer-tags.use-case.js';
import { UnassignCustomerTagUseCase } from '../src/application/use-cases/unassign-customer-tag.use-case.js';
import { CustomerRepository } from '../src/infrastructure/repositories/customer.repository.js';
import { CustomerTagRepository } from '../src/infrastructure/repositories/customer-tag.repository.js';

describe('Customer Tags & Assignments Integration Tests', () => {
  let customerRepo: CustomerRepository;
  let tagRepo: CustomerTagRepository;
  let createTagUseCase: CreateCustomerTagUseCase;
  let getTagsUseCase: GetCustomerTagsUseCase;
  let deleteTagUseCase: DeleteCustomerTagUseCase;
  let assignTagUseCase: AssignCustomerTagUseCase;
  let unassignTagUseCase: UnassignCustomerTagUseCase;
  let getDetailsUseCase: GetCustomerDetailsUseCase;

  beforeEach(async () => {
    await truncateAllTables(db);
    customerRepo = new CustomerRepository(db);
    tagRepo = new CustomerTagRepository(db);

    createTagUseCase = new CreateCustomerTagUseCase(tagRepo);
    getTagsUseCase = new GetCustomerTagsUseCase(tagRepo);
    deleteTagUseCase = new DeleteCustomerTagUseCase(tagRepo);
    assignTagUseCase = new AssignCustomerTagUseCase(customerRepo, tagRepo);
    unassignTagUseCase = new UnassignCustomerTagUseCase(customerRepo, tagRepo);
    getDetailsUseCase = new GetCustomerDetailsUseCase(customerRepo);
  });

  it('should create a business tag and list all tags in the business', async () => {
    const business = await createTestBusiness(db);

    const tag = await createTagUseCase.execute({
      businessId: business.id,
      name: 'VIP Client',
      color: '#FFD700',
      description: 'High value regular client',
    });

    expect(tag).toBeDefined();
    expect(tag.id).toBeDefined();
    expect(tag.name).toBe('VIP Client');
    expect(tag.color).toBe('#FFD700');

    const tags = await getTagsUseCase.execute(business.id);
    expect(tags).toHaveLength(1);
    expect(tags[0]?.name).toBe('VIP Client');
  });

  it('should throw ConflictError when creating duplicate tag name in same business', async () => {
    const business = await createTestBusiness(db);

    await createTagUseCase.execute({
      businessId: business.id,
      name: 'VIP',
    });

    await expect(
      createTagUseCase.execute({
        businessId: business.id,
        name: 'VIP',
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('should assign a tag to a customer and load it in customer details', async () => {
    const business = await createTestBusiness(db);
    const member = await createTestBusinessMember(db, { businessId: business.id });
    const customer = await createTestCustomer(db, business.id);

    const tag = await createTagUseCase.execute({
      businessId: business.id,
      name: 'Color Specialist Client',
      color: '#8A2BE2',
    });

    const assignment = await assignTagUseCase.execute(business.id, customer.id, tag.id, member.id);

    expect(assignment).toBeDefined();
    expect(assignment.customerTagId).toBe(tag.id);
    expect(assignment.businessCustomerId).toBe(customer.id);
    expect(assignment.assignedBy).toBe(member.id);

    // Verify tag appears in customer details view
    const details = await getDetailsUseCase.execute(business.id, customer.id);
    expect(details.tags).toHaveLength(1);
    expect(details.tags[0]?.name).toBe('Color Specialist Client');
  });

  it('should be idempotent when assigning the same tag multiple times', async () => {
    const business = await createTestBusiness(db);
    const customer = await createTestCustomer(db, business.id);
    const tag = await createTagUseCase.execute({
      businessId: business.id,
      name: 'VIP',
    });

    const assign1 = await assignTagUseCase.execute(business.id, customer.id, tag.id);
    const assign2 = await assignTagUseCase.execute(business.id, customer.id, tag.id);

    expect(assign1.customerTagId).toBe(tag.id);
    expect(assign2.customerTagId).toBe(tag.id);

    const details = await getDetailsUseCase.execute(business.id, customer.id);
    expect(details.tags).toHaveLength(1);
  });

  it('should unassign a tag from customer', async () => {
    const business = await createTestBusiness(db);
    const customer = await createTestCustomer(db, business.id);
    const tag = await createTagUseCase.execute({
      businessId: business.id,
      name: 'Special Care',
    });

    await assignTagUseCase.execute(business.id, customer.id, tag.id);
    const unassigned = await unassignTagUseCase.execute(business.id, customer.id, tag.id);
    expect(unassigned).toBe(true);

    const details = await getDetailsUseCase.execute(business.id, customer.id);
    expect(details.tags).toHaveLength(0);
  });

  it('should delete a tag definition and automatically cascade assignment cleanup', async () => {
    const business = await createTestBusiness(db);
    const customer = await createTestCustomer(db, business.id);
    const tag = await createTagUseCase.execute({
      businessId: business.id,
      name: 'Temporary Promotion',
    });

    await assignTagUseCase.execute(business.id, customer.id, tag.id);
    await deleteTagUseCase.execute(business.id, tag.id);

    const details = await getDetailsUseCase.execute(business.id, customer.id);
    expect(details.tags).toHaveLength(0);
  });

  it('should throw ResourceNotFoundError when tag does not exist during assignment', async () => {
    const business = await createTestBusiness(db);
    const customer = await createTestCustomer(db, business.id);

    await expect(
      assignTagUseCase.execute(business.id, customer.id, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow(ResourceNotFoundError);
  });

  it('REGRESSION: assignment never returns undefined when racing with unassignment', async () => {
    // Regression for the assignTag race condition: when a concurrent unassignment
    // deletes the row between onConflictDoNothing and the fallback select, the
    // repository must retry (re-insert) instead of returning `undefined`.
    const business = await createTestBusiness(db);
    const customer = await createTestCustomer(db, business.id);
    const tag = await createTagUseCase.execute({
      businessId: business.id,
      name: 'Race Tag',
    });

    // Interleave assigns and unassigns concurrently. Every assign promise must
    // resolve to a well-defined assignment entity (never undefined).
    const results = await Promise.all([
      tagRepo.assignTag(business.id, customer.id, tag.id),
      tagRepo.unassignTag(business.id, customer.id, tag.id),
      tagRepo.assignTag(business.id, customer.id, tag.id),
      tagRepo.unassignTag(business.id, customer.id, tag.id),
      tagRepo.assignTag(business.id, customer.id, tag.id),
    ]);

    const [a1, u1, a2, u2, a3] = results;
    expect(a1).toBeDefined();
    expect(a1.customerTagId).toBe(tag.id);
    expect(typeof u1).toBe('boolean');
    expect(a2).toBeDefined();
    expect(a2.customerTagId).toBe(tag.id);
    expect(typeof u2).toBe('boolean');
    expect(a3).toBeDefined();
    expect(a3.customerTagId).toBe(tag.id);

    // Final state must be consistent: exactly one assignment row exists.
    const tags = await getTagsUseCase.execute(business.id);
    expect(tags).toHaveLength(1);
  });
});
