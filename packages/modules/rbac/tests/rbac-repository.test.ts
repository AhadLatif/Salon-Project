import { db } from '@salon/database';
import { OWNER_ROLE_NAME } from '@salon/shared';
import { createTestBusiness, createTestRole, truncateAllTables } from '@salon/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RbacRepository } from '../src/infrastructure/repositories/rbac.repository.js';

describe('RbacRepository Integration Tests', () => {
  let repository: RbacRepository;

  beforeEach(async () => {
    await truncateAllTables(db);
    repository = new RbacRepository(db);
  });

  it('should create a custom business role', async () => {
    const business = await createTestBusiness(db);

    const role = await repository.createCustomRole({
      businessId: business.id,
      name: 'Receptionist',
      description: 'Front desk management role',
      permissionCodes: [],
    });

    expect(role).toBeDefined();
    expect(role.id).toBeDefined();
    expect(role.name).toBe('Receptionist');
    expect(role.businessId).toBe(business.id);
    expect(role.isSystem).toBe(false);
  });

  it('should return true for hasPermission when role is System Owner', async () => {
    const business = await createTestBusiness(db);

    // Create system owner role using factory with isSystem: true
    const ownerRole = await createTestRole(db, {
      businessId: business.id,
      name: OWNER_ROLE_NAME,
      isSystem: true,
    });

    const hasPerm = await repository.hasPermission(ownerRole.id, business.id, 'appointments:write');
    expect(hasPerm).toBe(true);
  });

  it('should retrieve business roles list', async () => {
    const business = await createTestBusiness(db);

    await repository.createCustomRole({
      businessId: business.id,
      name: 'Manager',
      description: 'Manager role',
      permissionCodes: [],
    });

    const roles = await repository.getBusinessRoles(business.id);
    expect(roles.length).toBe(1);
    expect(roles[0]).toBeDefined();
    expect(roles[0]?.name).toBe('Manager');
  });

  it('should return true for isOwner when role is System Owner and false otherwise', async () => {
    const business = await createTestBusiness(db);
    const otherBusiness = await createTestBusiness(db);

    const ownerRole = await createTestRole(db, {
      businessId: business.id,
      name: OWNER_ROLE_NAME,
      isSystem: true,
    });

    const customRole = await repository.createCustomRole({
      businessId: business.id,
      name: 'Manager',
      permissionCodes: [],
    });

    expect(await repository.isOwner(ownerRole.id, business.id)).toBe(true);
    expect(await repository.isOwner(customRole.id, business.id)).toBe(false);
    // Tenant isolation: Owner role from business 1 must return false for business 2
    expect(await repository.isOwner(ownerRole.id, otherBusiness.id)).toBe(false);
  });
});
