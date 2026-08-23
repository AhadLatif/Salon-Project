import { db } from '@salon/database';
import { ResourceNotFoundError, ValidationError } from '@salon/shared';
import {
  createTestBusiness,
  createTestBusinessMember,
  createTestStaffMember,
  createTestUser,
  truncateAllTables,
} from '@salon/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { IBusinessValidator } from '../src/application/ports/business-validator.port.js';
import type { IStaffValidator } from '../src/application/ports/staff-validator.port.js';
import { AddFavoriteUseCase } from '../src/application/use-cases/add-favorite.use-case.js';
import { GetUserFavoritesUseCase } from '../src/application/use-cases/get-user-favorites.use-case.js';
import { RemoveFavoriteUseCase } from '../src/application/use-cases/remove-favorite.use-case.js';
import { CustomerFavoriteRepository } from '../src/infrastructure/repositories/customer-favorite.repository.js';

describe('Customer Favorites Integration Tests', () => {
  let favoriteRepo: CustomerFavoriteRepository;
  let businessValidator: IBusinessValidator;
  let staffValidator: IStaffValidator;
  let addFavoriteUseCase: AddFavoriteUseCase;
  let removeFavoriteUseCase: RemoveFavoriteUseCase;
  let getFavoritesUseCase: GetUserFavoritesUseCase;

  beforeEach(async () => {
    await truncateAllTables(db);
    favoriteRepo = new CustomerFavoriteRepository(db);

    businessValidator = {
      businessExists: async (businessId: string) => {
        const [biz] = await db.query.businesses.findMany({
          where: (table, { eq }) => eq(table.id, businessId),
          limit: 1,
        });
        return Boolean(biz);
      },
    };

    staffValidator = {
      isStaffMemberActive: async (staffMemberId: string) => {
        const [staff] = await db.query.staffMembers.findMany({
          where: (table, { and, eq }) =>
            and(eq(table.id, staffMemberId), eq(table.status, 'active')),
          limit: 1,
        });
        return Boolean(staff);
      },
    };

    addFavoriteUseCase = new AddFavoriteUseCase(favoriteRepo, businessValidator, staffValidator);
    removeFavoriteUseCase = new RemoveFavoriteUseCase(favoriteRepo);
    getFavoritesUseCase = new GetUserFavoritesUseCase(favoriteRepo);
  });

  it('should successfully add a salon business to favorites', async () => {
    const user = await createTestUser(db);
    const business = await createTestBusiness(db);

    const favorite = await addFavoriteUseCase.execute({
      userId: user.id,
      businessId: business.id,
    });

    expect(favorite).toBeDefined();
    expect(favorite.userId).toBe(user.id);
    expect(favorite.businessId).toBe(business.id);
    expect(favorite.staffMemberId).toBeNull();

    const favorites = await getFavoritesUseCase.execute(user.id);
    expect(favorites).toHaveLength(1);
    expect(favorites[0]?.businessId).toBe(business.id);
  });

  it('should successfully add a staff member to favorites', async () => {
    const user = await createTestUser(db);
    const business = await createTestBusiness(db);
    const member = await createTestBusinessMember(db, { businessId: business.id });
    const staff = await createTestStaffMember(db, {
      businessId: business.id,
      businessMemberId: member.id,
    });

    const favorite = await addFavoriteUseCase.execute({
      userId: user.id,
      staffMemberId: staff.id,
    });

    expect(favorite.userId).toBe(user.id);
    expect(favorite.staffMemberId).toBe(staff.id);
    expect(favorite.businessId).toBeNull();
  });

  it('should throw ValidationError when providing both or neither target ID (exactly one target invariant)', async () => {
    const user = await createTestUser(db);
    const business = await createTestBusiness(db);

    // Neither target
    await expect(
      addFavoriteUseCase.execute({
        userId: user.id,
      }),
    ).rejects.toThrow(ValidationError);

    // Both targets
    await expect(
      addFavoriteUseCase.execute({
        userId: user.id,
        businessId: business.id,
        staffMemberId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ResourceNotFoundError when favoriting non-existent business', async () => {
    const user = await createTestUser(db);

    await expect(
      addFavoriteUseCase.execute({
        userId: user.id,
        businessId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toThrow(ResourceNotFoundError);
  });

  it('should be idempotent when favoriting the same target multiple times', async () => {
    const user = await createTestUser(db);
    const business = await createTestBusiness(db);

    const fav1 = await addFavoriteUseCase.execute({
      userId: user.id,
      businessId: business.id,
    });

    const fav2 = await addFavoriteUseCase.execute({
      userId: user.id,
      businessId: business.id,
    });

    expect(fav1.id).toBe(fav2.id);

    const favorites = await getFavoritesUseCase.execute(user.id);
    expect(favorites).toHaveLength(1);
  });

  it('should remove a favorite by ID', async () => {
    const user = await createTestUser(db);
    const business = await createTestBusiness(db);

    const fav = await addFavoriteUseCase.execute({
      userId: user.id,
      businessId: business.id,
    });

    const removed = await removeFavoriteUseCase.execute(fav.id, user.id);
    expect(removed).toBe(true);

    const remaining = await getFavoritesUseCase.execute(user.id);
    expect(remaining).toHaveLength(0);
  });
});
