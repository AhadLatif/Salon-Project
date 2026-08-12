import { db, openingHours } from '@salon/database';
import { ValidationError } from '@salon/shared';
import { createTestBusiness, truncateAllTables } from '@salon/testing';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateBranchUseCase } from '../src/application/use-cases/create-branch.use-case.js';
import { BranchRepository } from '../src/infrastructure/repositories/branch.repository.js';

describe('CreateBranchUseCase Integration Tests', () => {
  let branchRepository: BranchRepository;
  let useCase: CreateBranchUseCase;

  beforeEach(async () => {
    await truncateAllTables(db);
    branchRepository = new BranchRepository(db);
    useCase = new CreateBranchUseCase(branchRepository);
  });

  it('should create a branch with opening hours in transaction', async () => {
    const business = await createTestBusiness(db);

    const branch = await useCase.execute({
      businessId: business.id,
      name: 'Uptown Branch',
      timezone: 'America/New_York',
      currency: 'USD',
      addressLine1: '456 Uptown St',
      city: 'New York',
      countryCode: 'US',
      phoneNumber: '+1987654321',
      email: 'uptown@salon.com',
      openingHours: [
        {
          dayOfWeek: 1,
          isClosed: false,
          opensAt: '09:00',
          closesAt: '17:00',
          shiftName: null,
        },
        {
          dayOfWeek: 2,
          isClosed: true,
          opensAt: null,
          closesAt: null,
          shiftName: null,
        },
      ],
    });

    expect(branch).toBeDefined();
    expect(branch.id).toBeDefined();
    expect(branch.name).toBe('Uptown Branch');
    expect(branch.businessId).toBe(business.id);

    // Verify opening hours were inserted
    const hours = await db
      .select()
      .from(openingHours)
      .where(
        and(
          eq(openingHours.branchId, branch.id as string),
          eq(openingHours.businessId, business.id),
        ),
      );

    expect(hours).toHaveLength(2);
    expect(hours.find((h) => h.dayOfWeek === 1)?.opensAt).toBe('09:00:00');
    expect(hours.find((h) => h.dayOfWeek === 2)?.isClosed).toBe(true);
  });

  it('should throw ValidationError if opening hours are invalid', async () => {
    const business = await createTestBusiness(db);

    await expect(
      useCase.execute({
        businessId: business.id,
        name: 'Uptown Branch',
        timezone: 'America/New_York',
        currency: 'USD',
        addressLine1: '456 Uptown St',
        city: 'New York',
        countryCode: 'US',
        openingHours: [
          {
            dayOfWeek: 1,
            isClosed: false,
            opensAt: '17:00', // closes before opens
            closesAt: '09:00',
            shiftName: null,
          },
        ],
      }),
    ).rejects.toThrow(ValidationError);
  });
});
