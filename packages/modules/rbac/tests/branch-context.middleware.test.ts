import { ForbiddenError, UnauthorizedError, ValidationError } from '@salon/shared';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, type Mock, type Mocked, vi } from 'vitest';
import { createRequireBranchContextMiddleware } from '../src/api/middlewares/branch-context.middleware.js';
import type { IBranchValidator } from '../src/application/ports/branch-validator.port.js';
import type { IRbacRepository } from '../src/application/ports/rbac-repository.port.js';
import type { IStaffBranchAccessValidator } from '../src/application/ports/staff-branch-access-validator.port.js';

describe('Branch Context Middleware', () => {
  let mockRbacRepository: Mocked<IRbacRepository>;
  let mockBranchValidator: Mocked<IBranchValidator>;
  let mockStaffBranchValidator: Mocked<IStaffBranchAccessValidator>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: Mock;

  beforeEach(() => {
    mockRbacRepository = {
      getAllPermissions: vi.fn(),
      getBusinessRoles: vi.fn(),
      createCustomRole: vi.fn(),
      updateRolePermissions: vi.fn(),
      hasPermission: vi.fn(),
      isOwner: vi.fn().mockResolvedValue(false),
    } as unknown as Mocked<IRbacRepository>;

    mockBranchValidator = {
      isBranchInBusiness: vi.fn().mockResolvedValue(true),
    };

    mockStaffBranchValidator = {
      hasStaffBranchAssignment: vi.fn().mockResolvedValue(false),
    };

    const tenant: NonNullable<Request['tenant']> = {
      memberId: 'member-1',
      roleId: 'role-1',
      businessId: 'biz-1',
    };

    req = {
      user: { userId: 'user-1', email: 'test@example.com' },
      tenant,
      headers: {},
    };
    res = {};
    next = vi.fn();
  });

  const runMiddleware = async () => {
    const middleware = createRequireBranchContextMiddleware(
      mockRbacRepository,
      mockBranchValidator,
      mockStaffBranchValidator,
    );
    await middleware(req as Request, res as Response, next);
  };

  it('should throw UnauthorizedError if req.user is missing', async () => {
    delete req.user;
    await runMiddleware();

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('should throw Error if req.tenant is missing', async () => {
    delete req.tenant;
    await runMiddleware();

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should throw ValidationError if x-branch-id header is missing', async () => {
    await runMiddleware();

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    expect(req.tenant?.branchId).toBeUndefined();
    expect(mockRbacRepository.isOwner).not.toHaveBeenCalled();
  });

  it('should throw ValidationError if x-branch-id is invalid UUID', async () => {
    req.headers = { 'x-branch-id': 'invalid-uuid' };
    await runMiddleware();

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    expect(req.tenant?.branchId).toBeUndefined();
  });

  it('should throw ForbiddenError if staff member is not assigned to branch (non-owner)', async () => {
    const branchId = '123e4567-e89b-12d3-a456-426614174000';
    req.headers = { 'x-branch-id': branchId };
    mockRbacRepository.isOwner.mockResolvedValue(false);
    mockStaffBranchValidator.hasStaffBranchAssignment.mockResolvedValue(false);

    await runMiddleware();

    expect(mockRbacRepository.isOwner).toHaveBeenCalledWith('role-1', 'biz-1');
    expect(mockStaffBranchValidator.hasStaffBranchAssignment).toHaveBeenCalledWith(
      'biz-1',
      'member-1',
      branchId,
    );
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(req.tenant?.branchId).toBeUndefined();
  });

  it('should inject branchId into req.tenant and call next() if staff is assigned to branch', async () => {
    const branchId = '123e4567-e89b-12d3-a456-426614174000';
    req.headers = { 'x-branch-id': branchId };
    mockRbacRepository.isOwner.mockResolvedValue(false);
    mockStaffBranchValidator.hasStaffBranchAssignment.mockResolvedValue(true);

    await runMiddleware();

    expect(mockStaffBranchValidator.hasStaffBranchAssignment).toHaveBeenCalledWith(
      'biz-1',
      'member-1',
      branchId,
    );
    expect(next).toHaveBeenCalledWith(); // Called with no error
    expect(req.tenant?.branchId).toBe(branchId);
  });

  it('should inject branchId into req.tenant and call next() for System Owner when branch exists', async () => {
    const branchId = '123e4567-e89b-12d3-a456-426614174000';
    req.headers = { 'x-branch-id': branchId };
    mockRbacRepository.isOwner.mockResolvedValue(true);
    mockBranchValidator.isBranchInBusiness.mockResolvedValue(true);

    await runMiddleware();

    expect(mockRbacRepository.isOwner).toHaveBeenCalledWith('role-1', 'biz-1');
    expect(mockBranchValidator.isBranchInBusiness).toHaveBeenCalledWith('biz-1', branchId);
    expect(mockStaffBranchValidator.hasStaffBranchAssignment).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
    expect(req.tenant?.branchId).toBe(branchId);
  });

  it('should deny System Owner access when the branch is outside the business', async () => {
    req.headers = { 'x-branch-id': '123e4567-e89b-12d3-a456-426614174000' };
    mockRbacRepository.isOwner.mockResolvedValue(true);
    mockBranchValidator.isBranchInBusiness.mockResolvedValue(false);

    await runMiddleware();

    expect(mockStaffBranchValidator.hasStaffBranchAssignment).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(req.tenant?.branchId).toBeUndefined();
  });
});
