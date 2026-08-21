import { ForbiddenError, getTenantContext, getUuidParam, validateBody } from '@salon/shared';
import type { NextFunction, Request, Response } from 'express';
import type { AddShiftToScheduleUseCase } from '../../application/use-cases/add-shift-to-schedule.use-case.js';
import type { AssignServiceToStaffUseCase } from '../../application/use-cases/assign-service-to-staff.use-case.js';
import type { AssignStaffToBranchUseCase } from '../../application/use-cases/assign-staff-to-branch.use-case.js';
import type { CreateStaffMemberUseCase } from '../../application/use-cases/create-staff-member.use-case.js';
import type { CreateStaffWorkScheduleUseCase } from '../../application/use-cases/create-staff-work-schedule.use-case.js';
import type { DeactivateStaffMemberUseCase } from '../../application/use-cases/deactivate-staff-member.use-case.js';
import type { GetStaffMemberDetailsUseCase } from '../../application/use-cases/get-staff-member-details.use-case.js';
import type { GetStaffMembersUseCase } from '../../application/use-cases/get-staff-members.use-case.js';
import type { GetStaffWorkSchedulesUseCase } from '../../application/use-cases/get-staff-work-schedules.use-case.js';
import type { UnassignServiceFromStaffUseCase } from '../../application/use-cases/unassign-service-from-staff.use-case.js';
import type { UnassignStaffFromBranchUseCase } from '../../application/use-cases/unassign-staff-from-branch.use-case.js';
import type { UpdateStaffMemberUseCase } from '../../application/use-cases/update-staff-member.use-case.js';
import { addShiftToScheduleSchema } from '../dtos/add-shift-to-schedule.schema.js';
import { assignServiceToStaffSchema } from '../dtos/assign-service-to-staff.schema.js';
import { assignStaffToBranchSchema } from '../dtos/assign-staff-to-branch.schema.js';
import { createStaffMemberSchema } from '../dtos/create-staff-member.schema.js';
import { createStaffWorkScheduleSchema } from '../dtos/create-staff-work-schedule.schema.js';
import { updateStaffMemberSchema } from '../dtos/update-staff-member.schema.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant?: {
        businessId: string;
        memberId: string;
        roleId: string;
        branchId?: string;
      };
    }
  }
}

export class StaffMemberController {
  constructor(
    private readonly createStaffMemberUseCase: CreateStaffMemberUseCase,
    private readonly updateStaffMemberUseCase: UpdateStaffMemberUseCase,
    private readonly deactivateStaffMemberUseCase: DeactivateStaffMemberUseCase,
    private readonly getStaffMemberDetailsUseCase: GetStaffMemberDetailsUseCase,
    private readonly getStaffMembersUseCase: GetStaffMembersUseCase,
    private readonly assignStaffToBranchUseCase: AssignStaffToBranchUseCase,
    private readonly unassignStaffFromBranchUseCase: UnassignStaffFromBranchUseCase,
    private readonly assignServiceToStaffUseCase: AssignServiceToStaffUseCase,
    private readonly unassignServiceFromStaffUseCase: UnassignServiceFromStaffUseCase,
    private readonly createStaffWorkScheduleUseCase: CreateStaffWorkScheduleUseCase,
    private readonly addShiftToScheduleUseCase: AddShiftToScheduleUseCase,
    private readonly getStaffWorkSchedulesUseCase: GetStaffWorkSchedulesUseCase,
  ) {}

  /**
   * Onboards a new staff member profile linked to an existing business member.
   *
   * @http POST /api/v1/businesses/:businessId/staff
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   * @body
   *   - businessMemberId: string (UUID, must belong to this business)
   *   - displayName: string (1-200 chars)
   *   - jobTitle?: string
   *   - biography?: string
   *   - employmentType?: 'full_time' | 'part_time' | 'contractor'
   *   - hireDate?: 'YYYY-MM-DD' (valid calendar date)
   *   - excludeFromAutoAssignment?: boolean
   *   - languages?: string[]
   *   - socialLinks?: Record<string, string>
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('staff.manage')
   *          -> StaffMemberController.create
   *          -> validateBody(createStaffMemberSchema)
   *          -> CreateStaffMemberUseCase.execute
   *          -> BusinessValidationService (verifies businessMemberId belongs to businessId)
   *          -> StaffRepository.create
   *
   * @returns 201 Created { success: true, data: { staff: { id, displayName, ... } }, meta: {} }
   * @throws 400 Bad Request (Validation failure / impossible calendar date)
   * @throws 403 Forbidden (Cross-tenant IDOR: member belongs to another business)
   * @throws 409 Conflict (Staff profile already exists for this business member)
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const data = validateBody(
        createStaffMemberSchema,
        { ...req.body, businessId },
        'Invalid staff member data',
      );

      const staff = await this.createStaffMemberUseCase.execute(data);

      res.status(201).json({
        success: true,
        data: { staff },
        error: null,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Returns all active staff members in the business tenant.
   *
   * @http GET /api/v1/businesses/:businessId/staff
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware
   *          -> StaffMemberController.findAll
   *          -> GetStaffMembersUseCase.execute(businessId)
   *          -> StaffRepository.findAllByBusinessId
   *
   * @returns 200 OK { success: true, data: { staff: [ ... ] }, meta: {} }
   */
  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const staff = await this.getStaffMembersUseCase.execute(businessId);
      res.status(200).json({
        success: true,
        data: { staff },
        error: null,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Returns complete profile details for a specific staff member.
   *
   * @http GET /api/v1/businesses/:businessId/staff/:staffMemberId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :staffMemberId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware
   *          -> StaffMemberController.findById
   *          -> GetStaffMemberDetailsUseCase.execute(businessId, staffMemberId)
   *          -> StaffRepository.findById
   *
   * @returns 200 OK { success: true, data: { staff: { ... } }, meta: {} }
   * @throws 404 Not Found
   */
  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const staffMemberId = getUuidParam(req, 'staffMemberId');

      const staff = await this.getStaffMemberDetailsUseCase.execute(businessId, staffMemberId);
      res.status(200).json({
        success: true,
        data: { staff },
        error: null,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates staff member profile attributes.
   *
   * @http PATCH /api/v1/businesses/:businessId/staff/:staffMemberId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :staffMemberId (UUID)
   * @body
   *   - Partial<UpdateStaffMemberDto>
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('staff.manage')
   *          -> StaffMemberController.update
   *          -> validateBody(updateStaffMemberSchema)
   *          -> UpdateStaffMemberUseCase.execute(businessId, staffMemberId, data)
   *          -> StaffRepository.update
   *
   * @returns 200 OK { success: true, data: { staff: { ... } }, meta: {} }
   * @throws 400 Bad Request
   * @throws 404 Not Found
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const staffMemberId = getUuidParam(req, 'staffMemberId');
      const data = validateBody(updateStaffMemberSchema, req.body, 'Invalid staff member data');

      const staff = await this.updateStaffMemberUseCase.execute(businessId, staffMemberId, data);
      res.status(200).json({
        success: true,
        data: { staff },
        error: null,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Soft-terminates a staff member, marking status='terminated' and unassigning active services.
   *
   * @http DELETE /api/v1/businesses/:businessId/staff/:staffMemberId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :staffMemberId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('staff.manage')
   *          -> StaffMemberController.deactivate
   *          -> DeactivateStaffMemberUseCase.execute(businessId, staffMemberId)
   *          -> StaffRepository.softTerminate
   *
   * @returns 200 OK { success: true, data: null, meta: {} }
   * @throws 404 Not Found
   */
  async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const staffMemberId = getUuidParam(req, 'staffMemberId');

      await this.deactivateStaffMemberUseCase.execute(businessId, staffMemberId);
      res.status(200).json({
        success: true,
        data: null,
        error: null,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Assigns staff to a branch using atomic CAS primary branch switching.
   *
   * @http POST /api/v1/businesses/:businessId/staff/:staffMemberId/branches
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :staffMemberId (UUID)
   * @body
   *   - branchId: string (UUID)
   *   - isPrimary?: boolean
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('staff.manage')
   *          -> StaffMemberController.assignToBranch
   *          -> validateBody(assignStaffToBranchSchema)
   *          -> AssignStaffToBranchUseCase.execute
   *          -> StaffRepository.assignToBranch (atomic CAS transaction)
   *
   * @returns 201 Created { success: true, data: { assignment: { ... } }, meta: {} }
   * @throws 400 Bad Request
   * @throws 403 Forbidden (Cross-tenant branch or staff member)
   */
  async assignToBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const staffMemberId = getUuidParam(req, 'staffMemberId');
      const data = validateBody(
        assignStaffToBranchSchema,
        req.body,
        'Invalid branch assignment data',
      );

      const assignment = await this.assignStaffToBranchUseCase.execute(
        businessId,
        staffMemberId,
        data.branchId,
        data.isPrimary,
      );
      res.status(201).json({
        success: true,
        data: { assignment },
        error: null,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unassigns a staff member from a branch.
   *
   * @http DELETE /api/v1/businesses/:businessId/staff/:staffMemberId/branches/:branchId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :staffMemberId (UUID)
   *   - :branchId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('staff.manage')
   *          -> StaffMemberController.unassignFromBranch
   *          -> UnassignStaffFromBranchUseCase.execute
   *          -> StaffRepository.unassignFromBranch
   *
   * @returns 200 OK { success: true, data: null, meta: {} }
   * @throws 404 Not Found
   */
  async unassignFromBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const staffMemberId = getUuidParam(req, 'staffMemberId');
      const branchId = getUuidParam(req, 'branchId');

      await this.unassignStaffFromBranchUseCase.execute(businessId, staffMemberId, branchId);
      res.status(200).json({
        success: true,
        data: null,
        error: null,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Allocates a catalog service to a staff member with optional custom price/duration overrides.
   *
   * @http POST /api/v1/businesses/:businessId/staff/:staffMemberId/services
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :staffMemberId (UUID)
   * @body
   *   - serviceId: string (UUID)
   *   - overridePrice?: string (decimal)
   *   - overrideDurationMinutes?: number
   *   - isBookable?: boolean
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('staff.manage')
   *          -> StaffMemberController.assignService
   *          -> validateBody(assignServiceToStaffSchema)
   *          -> AssignServiceToStaffUseCase.execute
   *          -> StaffRepository.assignService
   *
   * @returns 201 Created { success: true, data: { assignment: { ... } }, meta: {} }
   * @throws 400 Bad Request
   * @throws 403 Forbidden (Cross-tenant service or staff member)
   */
  async assignService(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const staffMemberId = getUuidParam(req, 'staffMemberId');
      const data = validateBody(
        assignServiceToStaffSchema,
        req.body,
        'Invalid service assignment data',
      );

      const assignment = await this.assignServiceToStaffUseCase.execute(
        businessId,
        staffMemberId,
        data.serviceId,
        {
          overridePrice: data.overridePrice,
          overrideDurationMinutes: data.overrideDurationMinutes,
          isBookable: data.isBookable,
        },
      );
      res.status(201).json({
        success: true,
        data: { assignment },
        error: null,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Removes a service allocation from a staff member.
   *
   * @http DELETE /api/v1/businesses/:businessId/staff/:staffMemberId/services/:serviceId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :staffMemberId (UUID)
   *   - :serviceId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('staff.manage')
   *          -> StaffMemberController.unassignService
   *          -> UnassignServiceFromStaffUseCase.execute
   *          -> StaffRepository.unassignService
   *
   * @returns 200 OK { success: true, data: null, meta: {} }
   * @throws 404 Not Found
   */
  async unassignService(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const staffMemberId = getUuidParam(req, 'staffMemberId');
      const serviceId = getUuidParam(req, 'serviceId');

      await this.unassignServiceFromStaffUseCase.execute(businessId, staffMemberId, serviceId);
      res.status(200).json({
        success: true,
        data: null,
        error: null,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Creates a working schedule for a staff member at a specific branch.
   *
   * @http POST /api/v1/businesses/:businessId/staff/:staffMemberId/schedules
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   *   - x-branch-id: <UUID> (Branch context)
   * @params
   *   - :businessId (UUID)
   *   - :staffMemberId (UUID)
   * @body
   *   - effectiveFrom: 'YYYY-MM-DD'
   *   - effectiveUntil?: 'YYYY-MM-DD'
   *   - shifts?: Array<{ dayOfWeek: 0-6, startsAt: 'HH:mm', endsAt: 'HH:mm', isWorkingDay?: boolean }>
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> branchContextMiddleware -> requirePermission('staff.manage')
   *          -> StaffMemberController.createWorkSchedule
   *          -> validateBody(createStaffWorkScheduleSchema)
   *          -> CreateStaffWorkScheduleUseCase.execute
   *          -> StaffRepository.createWorkSchedule (transaction: schedule + shifts)
   *
   * @returns 201 Created { success: true, data: { schedule: { ... } }, meta: {} }
   * @throws 400 Bad Request
   * @throws 403 Forbidden (Branch context mismatch)
   */
  async createWorkSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const staffMemberId = getUuidParam(req, 'staffMemberId');
      const data = validateBody(
        createStaffWorkScheduleSchema,
        req.body,
        'Invalid work schedule data',
      );

      if (!req.tenant?.branchId) {
        throw new Error('Tenant branch context missing.');
      }

      if ('branchId' in data && data.branchId !== req.tenant.branchId) {
        throw new ForbiddenError(
          'Requested branch ID does not match the authorized branch context.',
        );
      }

      const schedule = await this.createStaffWorkScheduleUseCase.execute(
        businessId,
        staffMemberId,
        req.tenant.branchId,
        data,
      );
      res.status(201).json({
        success: true,
        data: { schedule },
        error: null,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Returns all work schedules for a staff member at the active branch.
   *
   * @http GET /api/v1/businesses/:businessId/staff/:staffMemberId/schedules
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   *   - x-branch-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :staffMemberId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> branchContextMiddleware
   *          -> StaffMemberController.getWorkSchedules
   *          -> GetStaffWorkSchedulesUseCase.execute(businessId, staffMemberId, branchId)
   *          -> StaffRepository.getWorkSchedules
   *
   * @returns 200 OK { success: true, data: { schedules: [ ... ] }, meta: {} }
   */
  async getWorkSchedules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const staffMemberId = getUuidParam(req, 'staffMemberId');

      if (!req.tenant?.branchId) {
        throw new Error('Tenant branch context missing.');
      }

      const schedules = await this.getStaffWorkSchedulesUseCase.execute(
        businessId,
        staffMemberId,
        req.tenant.branchId,
      );
      res.status(200).json({
        success: true,
        data: { schedules },
        error: null,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Adds an individual shift to an existing work schedule.
   *
   * @http POST /api/v1/businesses/:businessId/staff/schedules/:workScheduleId/shifts
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   *   - x-branch-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :workScheduleId (UUID)
   * @body
   *   - dayOfWeek: 0-6 (0=Sunday)
   *   - startsAt: 'HH:mm'
   *   - endsAt: 'HH:mm'
   *   - isWorkingDay?: boolean
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> branchContextMiddleware -> requirePermission('staff.manage')
   *          -> StaffMemberController.addShiftToSchedule
   *          -> validateBody(addShiftToScheduleSchema)
   *          -> AddShiftToScheduleUseCase.execute
   *          -> StaffRepository.addShiftToSchedule
   *
   * @returns 201 Created { success: true, data: { shift: { ... } }, meta: {} }
   * @throws 400 Bad Request (Invalid time interval / startsAt >= endsAt)
   * @throws 404 Not Found (Schedule not found)
   */
  async addShiftToSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const workScheduleId = getUuidParam(req, 'workScheduleId');
      const data = validateBody(addShiftToScheduleSchema, req.body, 'Invalid shift data');

      if (!req.tenant?.branchId) {
        throw new Error('Tenant branch context missing.');
      }

      const shift = await this.addShiftToScheduleUseCase.execute(
        businessId,
        req.tenant.branchId,
        workScheduleId,
        data,
      );

      res.status(201).json({
        success: true,
        data: { shift },
        error: null,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  }
}
