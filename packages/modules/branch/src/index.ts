import type { db } from '@salon/database';
import { type RequestHandler, Router } from 'express';
import { BranchController } from './api/controllers/branch.controller.js';
import { CreateBranchUseCase } from './application/use-cases/create-branch.use-case.js';
import { DeleteBranchUseCase } from './application/use-cases/delete-branch.use-case.js';
import { GetBranchByIdUseCase } from './application/use-cases/get-branch-by-id.use-case.js';
import { GetBusinessBranchesUseCase } from './application/use-cases/get-business-branches.use-case.js';
import { ReplaceBranchOpeningHoursUseCase } from './application/use-cases/replace-branch-opening-hours.use-case.js';
import { UpdateBranchUseCase } from './application/use-cases/update-branch.use-case.js';
import { BranchRepository } from './infrastructure/repositories/branch.repository.js';

export * from './api/controllers/branch.controller.js';
export * from './api/docs/branch.openapi.js';
export * from './api/dtos/create-branch.schema.js';
export * from './api/dtos/update-branch.schema.js';
export * from './api/dtos/update-branch-hours.schema.js';
export * from './application/ports/branch-repository.port.js';
export * from './application/use-cases/create-branch.use-case.js';
export * from './application/use-cases/delete-branch.use-case.js';
export * from './application/use-cases/get-branch-by-id.use-case.js';
export * from './application/use-cases/get-business-branches.use-case.js';
export * from './application/use-cases/replace-branch-opening-hours.use-case.js';
export * from './application/use-cases/update-branch.use-case.js';
export * from './domain/entities/branch.entity.js';
export * from './infrastructure/repositories/branch.repository.js';

export interface BranchModuleDependencies {
  database: typeof db;
  authMiddleware: RequestHandler;
  tenantMiddleware: RequestHandler;
  requirePermission: (permissionCode: string) => RequestHandler;
}

export interface BranchModule {
  branchRouter: Router;
  useCases: {
    createBranchUseCase: CreateBranchUseCase;
    updateBranchUseCase: UpdateBranchUseCase;
    replaceBranchOpeningHoursUseCase: ReplaceBranchOpeningHoursUseCase;
    getBranchByIdUseCase: GetBranchByIdUseCase;
    getBusinessBranchesUseCase: GetBusinessBranchesUseCase;
    deleteBranchUseCase: DeleteBranchUseCase;
  };
}

export function createBranchModule(deps: BranchModuleDependencies): BranchModule {
  const branchRepository = new BranchRepository(deps.database);

  const createBranchUseCase = new CreateBranchUseCase(branchRepository);
  const updateBranchUseCase = new UpdateBranchUseCase(branchRepository);
  const replaceBranchOpeningHoursUseCase = new ReplaceBranchOpeningHoursUseCase(branchRepository);
  const getBranchByIdUseCase = new GetBranchByIdUseCase(branchRepository);
  const getBusinessBranchesUseCase = new GetBusinessBranchesUseCase(branchRepository);
  const deleteBranchUseCase = new DeleteBranchUseCase(branchRepository);

  const branchController = new BranchController(
    createBranchUseCase,
    updateBranchUseCase,
    replaceBranchOpeningHoursUseCase,
    getBranchByIdUseCase,
    getBusinessBranchesUseCase,
    deleteBranchUseCase,
  );

  const branchRouter = Router({ mergeParams: true });

  // Middleware applied to all branch routes
  branchRouter.use(deps.authMiddleware);
  branchRouter.use(deps.tenantMiddleware);

  branchRouter.get('/', deps.requirePermission('branch.read'), branchController.getBranches);

  branchRouter.get(
    '/:branchId',
    deps.requirePermission('branch.read'),
    branchController.getBranchById,
  );

  branchRouter.post('/', deps.requirePermission('branch.create'), branchController.createBranch);

  branchRouter.patch(
    '/:branchId',
    deps.requirePermission('branch.update'),
    branchController.updateBranch,
  );

  branchRouter.put(
    '/:branchId/hours',
    deps.requirePermission('branch.update'),
    branchController.updateBranchHours,
  );

  branchRouter.delete(
    '/:branchId',
    deps.requirePermission('branch.delete'),
    branchController.deleteBranch,
  );

  return {
    branchRouter,
    useCases: {
      createBranchUseCase,
      updateBranchUseCase,
      replaceBranchOpeningHoursUseCase,
      getBranchByIdUseCase,
      getBusinessBranchesUseCase,
      deleteBranchUseCase,
    },
  };
}
