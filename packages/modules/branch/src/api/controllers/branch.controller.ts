import { getTenantContext, getUuidParam, validateBody } from '@salon/shared';
import type { Request, Response } from 'express';
import type { CreateBranchUseCase } from '../../application/use-cases/create-branch.use-case.js';
import type { DeleteBranchUseCase } from '../../application/use-cases/delete-branch.use-case.js';
import type { GetBranchByIdUseCase } from '../../application/use-cases/get-branch-by-id.use-case.js';
import type { GetBusinessBranchesUseCase } from '../../application/use-cases/get-business-branches.use-case.js';
import type { ReplaceBranchOpeningHoursUseCase } from '../../application/use-cases/replace-branch-opening-hours.use-case.js';
import type { UpdateBranchUseCase } from '../../application/use-cases/update-branch.use-case.js';
import { createBranchSchema } from '../dtos/create-branch.schema.js';
import { updateBranchSchema } from '../dtos/update-branch.schema.js';
import { updateBranchHoursSchema } from '../dtos/update-branch-hours.schema.js';

export class BranchController {
  constructor(
    private readonly createBranchUseCase: CreateBranchUseCase,
    private readonly updateBranchUseCase: UpdateBranchUseCase,
    private readonly replaceBranchOpeningHoursUseCase: ReplaceBranchOpeningHoursUseCase,
    private readonly getBranchByIdUseCase: GetBranchByIdUseCase,
    private readonly getBusinessBranchesUseCase: GetBusinessBranchesUseCase,
    private readonly deleteBranchUseCase: DeleteBranchUseCase,
  ) {}

  /**
   * Returns all salon branches belonging to the authenticated business tenant.
   *
   * @http GET /api/v1/businesses/:businessId/branches
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware
   *          -> BranchController.getBranches
   *          -> GetBusinessBranchesUseCase.execute(businessId)
   *          -> BranchRepository.findAllByBusinessId
   *
   * @returns 200 OK { success: true, data: { branches: [ ... ] }, meta: {} }
   * @throws 401 Unauthorized
   * @throws 403 Forbidden (Cross-tenant IDOR)
   */
  public getBranches = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = getTenantContext(req);

    const branches = await this.getBusinessBranchesUseCase.execute(businessId);

    res.status(200).json({
      success: true,
      data: { branches: branches.map((b) => b.toJSON()) },
      meta: {},
    });
  };

  /**
   * Returns a specific branch with its opening hours.
   *
   * @http GET /api/v1/businesses/:businessId/branches/:branchId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :branchId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware
   *          -> BranchController.getBranchById
   *          -> GetBranchByIdUseCase.execute(businessId, branchId)
   *          -> BranchRepository.findById
   *
   * @returns 200 OK { success: true, data: { branch: { ... } }, meta: {} }
   * @throws 400 Bad Request (Invalid UUID)
   * @throws 401 Unauthorized
   * @throws 403 Forbidden (Cross-tenant access)
   * @throws 404 Not Found (Branch not found)
   */
  public getBranchById = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = getTenantContext(req);
    const branchId = getUuidParam(req, 'branchId');

    const branch = await this.getBranchByIdUseCase.execute(businessId, branchId);

    res.status(200).json({
      success: true,
      data: { branch: branch.toJSON() },
      meta: {},
    });
  };

  /**
   * Creates a new branch with initial opening hours in a single transaction.
   *
   * @http POST /api/v1/businesses/:businessId/branches
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   * @body
   *   - name: string (1-200 chars)
   *   - isMain?: boolean
   *   - openingHours: Array<{ dayOfWeek: 0-6, openTime: 'HH:mm', closeTime: 'HH:mm', isClosed?: boolean, shiftName?: string }>
   *   - address: { line1, line2?, city, stateProvince?, postalCode?, countryCode }
   *   - contact: { email?, phoneNumber?, isPhoneVerified? }
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('branch.create')
   *          -> BranchController.createBranch
   *          -> validateBody(createBranchSchema)
   *          -> CreateBranchUseCase.execute
   *          -> BranchRepository.create (transaction: branch + opening_hours)
   *
   * @returns 201 Created { success: true, data: { branch: { ... } }, meta: {} }
   * @throws 400 Bad Request (Validation failed / invalid hours / overlapping shifts)
   * @throws 401 Unauthorized
   * @throws 403 Forbidden (Cross-tenant IDOR / insufficient permission)
   * @throws 409 Conflict (Branch name already in use)
   */
  public createBranch = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = getTenantContext(req);
    const data = validateBody(createBranchSchema, req.body, 'Invalid branch data');

    const branch = await this.createBranchUseCase.execute({
      ...data,
      businessId,
      openingHours: data.openingHours.map((h) => ({
        ...h,
        shiftName: h.shiftName ?? null,
      })),
    });

    res.status(201).json({
      success: true,
      data: { branch: branch.toJSON() },
      meta: {},
    });
  };

  /**
   * Updates branch details (name, address, contact, settings).
   *
   * @http PATCH /api/v1/businesses/:businessId/branches/:branchId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :branchId (UUID)
   * @body
   *   - Partial<UpdateBranchDto>
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('branch.update')
   *          -> BranchController.updateBranch
   *          -> validateBody(updateBranchSchema)
   *          -> UpdateBranchUseCase.execute(businessId, branchId, data)
   *          -> BranchRepository.update
   *
   * @returns 200 OK { success: true, data: { branch: { ... } }, meta: {} }
   * @throws 400 Bad Request
   * @throws 401 Unauthorized
   * @throws 403 Forbidden
   * @throws 404 Not Found
   */
  public updateBranch = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = getTenantContext(req);
    const branchId = getUuidParam(req, 'branchId');
    const data = validateBody(updateBranchSchema, req.body, 'Invalid branch update data');

    const branch = await this.updateBranchUseCase.execute(businessId, branchId, data);

    res.status(200).json({
      success: true,
      data: { branch: branch.toJSON() },
      meta: {},
    });
  };

  /**
   * Atomically replaces the entire opening hours schedule for a branch.
   *
   * @http PUT /api/v1/businesses/:businessId/branches/:branchId/hours
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :branchId (UUID)
   * @body
   *   - openingHours: Array<{ dayOfWeek: 0-6, openTime: 'HH:mm', closeTime: 'HH:mm', isClosed?: boolean, shiftName?: string }>
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('branch.update')
   *          -> BranchController.updateBranchHours
   *          -> validateBody(updateBranchHoursSchema)
   *          -> ReplaceBranchOpeningHoursUseCase.execute
   *          -> BranchRepository.replaceOpeningHours (transaction: DELETE all + batch INSERT)
   *
   * @returns 200 OK { success: true, data: { branch: { ... } }, meta: {} }
   * @throws 400 Bad Request (Invalid time range e.g. openTime >= closeTime)
   * @throws 404 Not Found
   */
  public updateBranchHours = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = getTenantContext(req);
    const branchId = getUuidParam(req, 'branchId');
    const data = validateBody(updateBranchHoursSchema, req.body, 'Invalid branch hours data');

    const branch = await this.replaceBranchOpeningHoursUseCase.execute(
      businessId,
      branchId,
      data.openingHours.map((h) => ({
        ...h,
        shiftName: h.shiftName ?? null,
      })),
    );

    res.status(200).json({
      success: true,
      data: { branch: branch.toJSON() },
      meta: {},
    });
  };

  /**
   * Soft-deletes a branch.
   *
   * @http DELETE /api/v1/businesses/:businessId/branches/:branchId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :branchId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('branch.delete')
   *          -> BranchController.deleteBranch
   *          -> DeleteBranchUseCase.execute(businessId, branchId)
   *          -> BranchRepository.delete
   *
   * @returns 204 No Content
   * @throws 404 Not Found
   */
  public deleteBranch = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = getTenantContext(req);
    const branchId = getUuidParam(req, 'branchId');

    await this.deleteBranchUseCase.execute(businessId, branchId);

    res.status(204).send();
  };
}
