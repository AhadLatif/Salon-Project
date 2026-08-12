import { ValidationError } from '@salon/shared';
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
    const businessId = req.tenant?.businessId;

    if (!businessId) {
      throw new ValidationError('Missing tenant businessId.', {
        'x-business-id': 'Tenant context is required.',
      });
    }

    const branches = await this.getBusinessBranchesUseCase.execute(businessId);

    res.status(200).json({
      success: true,
      data: { branches: branches.map((b) => b.toJSON()) },
      meta: {},
    });
  };

  public getBranchById = async (req: Request, res: Response): Promise<void> => {
    const businessId = req.tenant?.businessId;

    if (!businessId) {
      throw new ValidationError('Missing tenant businessId.', {
        'x-business-id': 'Tenant context is required.',
      });
    }

    const branchId = req.params.branchId as string;

    const branch = await this.getBranchByIdUseCase.execute(businessId, branchId);

    res.status(200).json({
      success: true,
      data: { branch: branch.toJSON() },
      meta: {},
    });
  };

  public createBranch = async (req: Request, res: Response): Promise<void> => {
    const businessId = req.tenant?.businessId;

    if (!businessId) {
      throw new ValidationError('Missing tenant businessId.', {
        'x-business-id': 'Tenant context is required.',
      });
    }

    // Validate request body
    const parseResult = createBranchSchema.safeParse(req.body);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parseResult.error.issues) {
        const fieldName = issue.path.join('.');
        if (fieldName) fieldErrors[fieldName] = issue.message;
      }
      throw new ValidationError('Invalid branch data', fieldErrors);
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
    const businessId = req.tenant?.businessId;

    if (!businessId) {
      throw new ValidationError('Missing tenant businessId.', {
        'x-business-id': 'Tenant context is required.',
      });
    }

    const branchId = req.params.branchId as string;

    const parseResult = updateBranchSchema.safeParse(req.body);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parseResult.error.issues) {
        const fieldName = issue.path.join('.');
        if (fieldName) fieldErrors[fieldName] = issue.message;
      }
      throw new ValidationError('Invalid branch update data', fieldErrors);
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
    const businessId = req.tenant?.businessId;

    if (!businessId) {
      throw new ValidationError('Missing tenant businessId.', {
        'x-business-id': 'Tenant context is required.',
      });
    }

    const branchId = req.params.branchId as string;

    const parseResult = updateBranchHoursSchema.safeParse(req.body);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parseResult.error.issues) {
        const fieldName = issue.path.join('.');
        if (fieldName) fieldErrors[fieldName] = issue.message;
      }
      throw new ValidationError('Invalid branch hours data', fieldErrors);
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
    const businessId = req.tenant?.businessId;

    if (!businessId) {
      throw new ValidationError('Missing tenant businessId.', {
        'x-business-id': 'Tenant context is required.',
      });
    }

    const branchId = req.params.branchId as string;

    await this.deleteBranchUseCase.execute(businessId, branchId);

    res.status(204).send();
  };
}
