import { ForbiddenError, ValidationError } from '@salon/shared';
import { z } from '@salon/validation';
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

const uuidSchema = z.uuid();

function parseUuidParam(value: string, paramName: string): string {
  const result = uuidSchema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(`Invalid ${paramName} format`, {
      [paramName]: 'Must be a valid UUID.',
    });
  }
  return result.data;
}

// SECURITY: IDOR Protection & Multi-Tenant Boundary
// This helper extracts the cryptographically verified businessId from the JWT context (req.tenant).
// It acts as an absolute isolation boundary. Even if an attacker forges a URL to access another
// business's staff, this function ensures the token's tenant matches the requested URL parameters.
function validateTenantConsistency(req: Request): string {
  const businessIdFromTenant = req.tenant?.businessId;
  if (!businessIdFromTenant) {
    // Invariant: tenantMiddleware populates req.tenant for every staff route.
    // Reaching here means the middleware chain is misconfigured, so fail as a 500.
    throw new Error('Tenant context missing after tenant middleware.');
  }

  // If there's a businessId in params/query, it must mathematically match the verified tenant.
  const businessIdFromPath = req.params.businessId;
  if (businessIdFromPath && businessIdFromPath !== businessIdFromTenant) {
    throw new ForbiddenError('Tenant context does not match the requested resource path.');
  }

  return businessIdFromTenant;
}

function formatZodErrors(issues: z.ZodIssue[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const fieldName = issue.path.join('.') || '_root';
    fieldErrors[fieldName] = issue.message;
  }
  return fieldErrors;
}

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

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = validateTenantConsistency(req);

      const parseResult = createStaffMemberSchema.safeParse({
        ...req.body,
        businessId,
      });

      if (!parseResult.success) {
        throw new ValidationError(
          'Invalid staff member data',
          formatZodErrors(parseResult.error.issues),
        );
      }

      const staff = await this.createStaffMemberUseCase.execute(parseResult.data);
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

  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = validateTenantConsistency(req);
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

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = validateTenantConsistency(req);
      const staffMemberId = parseUuidParam(req.params.staffMemberId as string, 'staffMemberId');

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

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = validateTenantConsistency(req);
      const staffMemberId = parseUuidParam(req.params.staffMemberId as string, 'staffMemberId');

      const parseResult = updateStaffMemberSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError(
          'Invalid staff member data',
          formatZodErrors(parseResult.error.issues),
        );
      }

      const staff = await this.updateStaffMemberUseCase.execute(
        businessId,
        staffMemberId,
        parseResult.data,
      );
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

  async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = validateTenantConsistency(req);
      const staffMemberId = parseUuidParam(req.params.staffMemberId as string, 'staffMemberId');

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

  async assignToBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = validateTenantConsistency(req);
      const staffMemberId = parseUuidParam(req.params.staffMemberId as string, 'staffMemberId');

      const parseResult = assignStaffToBranchSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError(
          'Invalid branch assignment data',
          formatZodErrors(parseResult.error.issues),
        );
      }

      const assignment = await this.assignStaffToBranchUseCase.execute(
        businessId,
        staffMemberId,
        parseResult.data.branchId,
        parseResult.data.isPrimary,
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

  async unassignFromBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = validateTenantConsistency(req);
      const staffMemberId = parseUuidParam(req.params.staffMemberId as string, 'staffMemberId');
      const branchId = parseUuidParam(req.params.branchId as string, 'branchId');

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

  async assignService(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = validateTenantConsistency(req);
      const staffMemberId = parseUuidParam(req.params.staffMemberId as string, 'staffMemberId');

      const parseResult = assignServiceToStaffSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError(
          'Invalid service assignment data',
          formatZodErrors(parseResult.error.issues),
        );
      }

      const assignment = await this.assignServiceToStaffUseCase.execute(
        businessId,
        staffMemberId,
        parseResult.data.serviceId,
        {
          overridePrice: parseResult.data.overridePrice,
          overrideDurationMinutes: parseResult.data.overrideDurationMinutes,
          isBookable: parseResult.data.isBookable,
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

  async unassignService(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = validateTenantConsistency(req);
      const staffMemberId = parseUuidParam(req.params.staffMemberId as string, 'staffMemberId');
      const serviceId = parseUuidParam(req.params.serviceId as string, 'serviceId');

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

  async createWorkSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = validateTenantConsistency(req);
      const staffMemberId = parseUuidParam(req.params.staffMemberId as string, 'staffMemberId');

      const parseResult = createStaffWorkScheduleSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError(
          'Invalid work schedule data',
          formatZodErrors(parseResult.error.issues),
        );
      }

      if (!req.tenant?.branchId) {
        throw new Error('Tenant branch context missing.');
      }

      if ('branchId' in parseResult.data && parseResult.data.branchId !== req.tenant.branchId) {
        throw new ForbiddenError(
          'Requested branch ID does not match the authorized branch context.',
        );
      }

      const schedule = await this.createStaffWorkScheduleUseCase.execute(
        businessId,
        staffMemberId,
        req.tenant.branchId,
        parseResult.data,
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

  async getWorkSchedules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = validateTenantConsistency(req);
      const staffMemberId = parseUuidParam(req.params.staffMemberId as string, 'staffMemberId');

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

  async addShiftToSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = validateTenantConsistency(req);

      const workScheduleId = parseUuidParam(req.params.workScheduleId as string, 'workScheduleId');

      const parseResult = addShiftToScheduleSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError('Invalid shift data', formatZodErrors(parseResult.error.issues));
      }

      if (!req.tenant?.branchId) {
        throw new Error('Tenant branch context missing.');
      }

      const shift = await this.addShiftToScheduleUseCase.execute(
        businessId,
        req.tenant.branchId,
        workScheduleId,
        parseResult.data,
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
