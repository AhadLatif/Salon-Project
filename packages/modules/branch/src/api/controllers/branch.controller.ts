import { ForbiddenError, ValidationError } from '@salon/shared';
import { z } from '@salon/validation';
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

const uuidSchema = z.string().uuid();

function parseUuidParam(value: string, paramName: string): string {
  const result = uuidSchema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(`Invalid ${paramName} format`, {
      [paramName]: 'Must be a valid UUID.',
    });
  }
  return result.data;
}

function validateTenantConsistency(req: Request): string {
  const businessIdFromTenant = req.tenant?.businessId;
  if (!businessIdFromTenant) {
    throw new ValidationError('Missing tenant businessId.', {
      'x-business-id': 'Tenant context is required.',
    });
  }

  const businessIdFromPath = req.params.id;
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
      };
    }
  }
}

export class BranchController {
  constructor(
    private readonly createBranchUseCase: CreateBranchUseCase,
    private readonly updateBranchUseCase: UpdateBranchUseCase,
    private readonly replaceBranchOpeningHoursUseCase: ReplaceBranchOpeningHoursUseCase,
    private readonly getBranchByIdUseCase: GetBranchByIdUseCase,
    private readonly getBusinessBranchesUseCase: GetBusinessBranchesUseCase,
    private readonly deleteBranchUseCase: DeleteBranchUseCase,
  ) {}

  public getBranches = async (req: Request, res: Response): Promise<void> => {
    const businessId = validateTenantConsistency(req);

    const branches = await this.getBusinessBranchesUseCase.execute(businessId);

    res.status(200).json({
      success: true,
      data: { branches: branches.map((b) => b.toJSON()) },
      meta: {},
    });
  };

  public getBranchById = async (req: Request, res: Response): Promise<void> => {
    const businessId = validateTenantConsistency(req);
    const branchId = parseUuidParam(req.params.branchId as string, 'branchId');

    const branch = await this.getBranchByIdUseCase.execute(businessId, branchId);

    res.status(200).json({
      success: true,
      data: { branch: branch.toJSON() },
      meta: {},
    });
  };

  public createBranch = async (req: Request, res: Response): Promise<void> => {
    const businessId = validateTenantConsistency(req);

    // Validate request body
    const parseResult = createBranchSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid branch data', formatZodErrors(parseResult.error.issues));
    }
    const data = parseResult.data;

    // Execute use case
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

  public updateBranch = async (req: Request, res: Response): Promise<void> => {
    const businessId = validateTenantConsistency(req);
    const branchId = parseUuidParam(req.params.branchId as string, 'branchId');

    const parseResult = updateBranchSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError(
        'Invalid branch update data',
        formatZodErrors(parseResult.error.issues),
      );
    }
    const data = parseResult.data;

    const branch = await this.updateBranchUseCase.execute(businessId, branchId, data);

    res.status(200).json({
      success: true,
      data: { branch: branch.toJSON() },
      meta: {},
    });
  };

  public updateBranchHours = async (req: Request, res: Response): Promise<void> => {
    const businessId = validateTenantConsistency(req);
    const branchId = parseUuidParam(req.params.branchId as string, 'branchId');

    const parseResult = updateBranchHoursSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError(
        'Invalid branch hours data',
        formatZodErrors(parseResult.error.issues),
      );
    }
    const data = parseResult.data;

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

  public deleteBranch = async (req: Request, res: Response): Promise<void> => {
    const businessId = validateTenantConsistency(req);
    const branchId = parseUuidParam(req.params.branchId as string, 'branchId');

    await this.deleteBranchUseCase.execute(businessId, branchId);

    res.status(204).send();
  };
}
