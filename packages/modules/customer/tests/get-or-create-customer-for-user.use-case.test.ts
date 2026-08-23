import { db } from '@salon/database';
import { ConflictError } from '@salon/shared';
import {
  createTestBusiness,
  createTestCustomer,
  createTestUser,
  truncateAllTables,
} from '@salon/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { GetOrCreateCustomerForUserUseCase } from '../src/application/use-cases/get-or-create-customer-for-user.use-case.js';
import { CustomerRepository } from '../src/infrastructure/repositories/customer.repository.js';

describe('GetOrCreateCustomerForUserUseCase — Ownership Guard', () => {
  let repo: CustomerRepository;
  let useCase: GetOrCreateCustomerForUserUseCase;

  beforeEach(async () => {
    await truncateAllTables(db);
    repo = new CustomerRepository(db);
    useCase = new GetOrCreateCustomerForUserUseCase(repo);
  });

  it('returns the existing profile when the email match already belongs to the same user', async () => {
    const business = await createTestBusiness(db);
    // business_customers.user_id → users.id FK requires a real user row.
    const user = await createTestUser(db, { id: '11111111-1111-1111-1111-111111111111' });
    const existing = await createTestCustomer(db, business.id, {
      userId: user.id,
      email: 'same@example.com',
    });

    const result = await useCase.execute({
      businessId: business.id,
      userId: user.id,
      firstName: 'New',
      email: 'same@example.com',
    });

    expect(result.id).toBe(existing.id);
    expect(result.userId).toBe(user.id);
  });

  it("does NOT return another user's linked profile when matching by email (ownership guard)", async () => {
    const business = await createTestBusiness(db);
    const otherUser = await createTestUser(db, { id: '22222222-2222-2222-2222-222222222222' });
    const myUser = await createTestUser(db, { id: '33333333-3333-3333-3333-333333333333' });
    // A profile that belongs to ANOTHER user, but has the same email we are matching.
    // The email being already taken is what enforces the ownership guard.
    await createTestCustomer(db, business.id, {
      userId: otherUser.id,
      email: 'taken@example.com',
      phoneNumber: null,
    });

    // The email is already claimed by another user in this business, so the
    // ownership guard kicks in: we never return their profile. Since the email
    // is already taken, the use case cannot create a new one either — it must
    // reject with a ConflictError instead of leaking data.
    await expect(
      useCase.execute({
        businessId: business.id,
        userId: myUser.id,
        firstName: 'Me',
        email: 'taken@example.com',
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('claims an unlinked walk-in profile matched by phone for the requesting user', async () => {
    const business = await createTestBusiness(db);
    const user = await createTestUser(db, { id: '44444444-4444-4444-4444-444444444444' });
    // Unlinked walk-in profile (userId null) matched by phone
    const walkIn = await createTestCustomer(db, business.id, {
      userId: null,
      email: null,
      phoneNumber: '+15550001111',
    });

    const result = await useCase.execute({
      businessId: business.id,
      userId: user.id,
      firstName: 'Claimer',
      phoneNumber: '+15550001111',
    });

    expect(result.id).toBe(walkIn.id);
    expect(result.userId).toBe(user.id);
  });

  it('throws ConflictError when another user concurrently claims an unlinked profile (concurrent claim)', async () => {
    const business = await createTestBusiness(db);
    const userA = await createTestUser(db, { id: '55555555-5555-5555-5555-555555555555' });
    const userB = await createTestUser(db, { id: '66666666-6666-6666-6666-666666666666' });
    await createTestCustomer(db, business.id, {
      userId: null,
      email: 'claim-race@example.com',
      phoneNumber: null,
    });

    // userA claims first
    const claimed = await useCase.execute({
      businessId: business.id,
      userId: userA.id,
      firstName: 'A',
      email: 'claim-race@example.com',
    });
    expect(claimed.userId).toBe(userA.id);

    // userB tries to claim the same (now-linked) profile -> ConflictError
    await expect(
      useCase.execute({
        businessId: business.id,
        userId: userB.id,
        firstName: 'B',
        email: 'claim-race@example.com',
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('returns a profile already linked to the user without re-claiming when matched by email and phone is absent', async () => {
    const business = await createTestBusiness(db);
    const user = await createTestUser(db, { id: '77777777-7777-7777-7777-777777777777' });
    const existing = await createTestCustomer(db, business.id, {
      userId: user.id,
      email: 'mine@example.com',
      phoneNumber: '+15550009999',
    });

    const result = await useCase.execute({
      businessId: business.id,
      userId: user.id,
      firstName: 'Mine',
      email: 'mine@example.com',
    });

    expect(result.id).toBe(existing.id);
    expect(result.userId).toBe(user.id);
  });
});
