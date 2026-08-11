import { businessRoles, db } from '@salon/database';
import { ConflictError, OWNER_ROLE_NAME } from '@salon/shared';
import { createTestUser, truncateAllTables } from '@salon/testing';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateBusinessUseCase } from '../src/application/use-cases/create-business.use-case.js';
import { BusinessRepository } from '../src/infrastructure/repositories/business.repository.js';

describe('CreateBusinessUseCase Integration Tests', () => {
  let businessRepository: BusinessRepository;
  let useCase: CreateBusinessUseCase;

  beforeEach(async () => {
    await truncateAllTables(db);
    businessRepository = new BusinessRepository(db);
    useCase = new CreateBusinessUseCase(businessRepository);
  });

  it('should create a business with Owner role and member link in transaction', async () => {
    const ownerUser = await createTestUser(db, { primaryEmail: 'owner@salon.com' });

    const business = await useCase.execute({
      ownerUserId: ownerUser.id,
      business: {
        name: 'Glamour Salon',
        slug: 'glamour-salon',
        email: 'info@glamoursalon.com',
        phoneNumber: '+1987654321',
        description: 'Luxury hair salon',
      },
    });

    expect(business).toBeDefined();
    expect(business.id).toBeDefined();
    expect(business.name).toBe('Glamour Salon');
    expect(business.slug).toBe('glamour-salon');
    expect(business.ownerUserId).toBe(ownerUser.id);

    // Verify Owner role exists for the created business
    const [ownerRole] = await db
      .select()
      .from(businessRoles)
      .where(
        and(
          eq(businessRoles.businessId, business.id),
          eq(businessRoles.name, OWNER_ROLE_NAME),
          eq(businessRoles.isSystem, true),
        ),
      );

    expect(ownerRole).toBeDefined();
    expect(ownerRole?.name).toBe(OWNER_ROLE_NAME);
    expect(ownerRole?.isSystem).toBe(true);

    // Verify membership lookup and role assignment
    const membership = await businessRepository.getMembership(ownerUser.id, business.id);
    expect(membership).not.toBeNull();
    expect(membership?.memberId).toBeDefined();
    expect(membership?.roleId).toBe(ownerRole?.id);
  });

  it('should throw ConflictError if slug already exists', async () => {
    const ownerUser = await createTestUser(db);

    await useCase.execute({
      ownerUserId: ownerUser.id,
      business: {
        name: 'First Salon',
        slug: 'unique-salon-slug',
        email: 'first@salon.com',
        phoneNumber: '+1987654321',
      },
    });

    await expect(
      useCase.execute({
        ownerUserId: ownerUser.id,
        business: {
          name: 'Duplicate Salon',
          slug: 'unique-salon-slug',
          email: 'second@salon.com',
          phoneNumber: '+1987654322',
        },
      }),
    ).rejects.toThrow(ConflictError);
  });
});
