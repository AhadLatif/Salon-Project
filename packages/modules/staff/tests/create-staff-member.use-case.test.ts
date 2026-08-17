import { db } from '@salon/database';
import { ConflictError } from '@salon/shared';
import { createTestBusiness, createTestBusinessMember, truncateAllTables } from '@salon/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateStaffMemberUseCase } from '../src/application/use-cases/create-staff-member.use-case.js';
import { StaffRepository } from '../src/infrastructure/repositories/staff.repository.js';

describe('CreateStaffMemberUseCase Integration Tests', () => {
  let repo: StaffRepository;
  let useCase: CreateStaffMemberUseCase;

  beforeEach(async () => {
    await truncateAllTables(db);
    repo = new StaffRepository(db);
    useCase = new CreateStaffMemberUseCase(repo);
  });

  it('should successfully create a staff member', async () => {
    // Arrange
    const business = await createTestBusiness(db);
    const businessMember = await createTestBusinessMember(db, { businessId: business.id });

    // Act
    const result = await useCase.execute({
      businessId: business.id,
      businessMemberId: businessMember.id,
      displayName: 'Jane Stylist',
      jobTitle: 'Hair Stylist',
      employmentType: 'full_time',
      excludeFromAutoAssignment: false,
    });

    // Assert
    expect(result).toBeDefined();
    expect(result.businessId).toBe(business.id);
    expect(result.businessMemberId).toBe(businessMember.id);
    expect(result.displayName).toBe('Jane Stylist');
    expect(result.jobTitle).toBe('Hair Stylist');
  });

  it('should throw ConflictError when staff member already exists for this business member', async () => {
    // Arrange
    const business = await createTestBusiness(db);
    const businessMember = await createTestBusinessMember(db, { businessId: business.id });

    await useCase.execute({
      businessId: business.id,
      businessMemberId: businessMember.id,
      displayName: 'Jane Stylist',
      employmentType: 'full_time',
    });

    // Act & Assert
    await expect(
      useCase.execute({
        businessId: business.id,
        businessMemberId: businessMember.id,
        displayName: 'Duplicate Jane',
        employmentType: 'part_time',
      }),
    ).rejects.toThrow(ConflictError);
  });
});
