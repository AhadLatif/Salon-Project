import type { db } from '@salon/database';
import type { PermissionCode } from '@salon/shared';
import { type RequestHandler, Router } from 'express';
import { ServiceController } from './api/controllers/service.controller.js';
import { ServiceCategoryController } from './api/controllers/service-category.controller.js';
import { serviceOpenApiRegistry } from './api/docs/service.openapi.js';
import { AssignServiceToBranchUseCase } from './application/use-cases/assign-service-to-branch.use-case.js';
import { CreateCategoryUseCase } from './application/use-cases/create-category.use-case.js';
import { CreateServiceUseCase } from './application/use-cases/create-service.use-case.js';
import { DeactivateCategoryUseCase } from './application/use-cases/deactivate-category.use-case.js';
import { DeactivateServiceUseCase } from './application/use-cases/deactivate-service.use-case.js';
import { GetCategoriesUseCase } from './application/use-cases/get-categories.use-case.js';
import { GetServiceBranchAssignmentsUseCase } from './application/use-cases/get-service-branch-assignments.use-case.js';
import { GetServiceByIdUseCase } from './application/use-cases/get-service-by-id.use-case.js';
import { GetServicesUseCase } from './application/use-cases/get-services.use-case.js';
import { UnassignServiceFromBranchUseCase } from './application/use-cases/unassign-service-from-branch.use-case.js';
import { UpdateCategoryUseCase } from './application/use-cases/update-category.use-case.js';
import { UpdateServiceUseCase } from './application/use-cases/update-service.use-case.js';
import { ServiceRepository } from './infrastructure/repositories/service.repository.js';
import { ServiceCategoryRepository } from './infrastructure/repositories/service-category.repository.js';

export { serviceOpenApiRegistry };

export interface ServiceModuleDependencies {
  database: typeof db;
  authMiddleware: RequestHandler;
  tenantMiddleware: RequestHandler;
  requirePermission: (permissionCode: PermissionCode) => RequestHandler;
}

export function createServiceModule(deps: ServiceModuleDependencies): Router {
  // 1. Repositories
  const categoryRepo = new ServiceCategoryRepository(deps.database);
  const serviceRepo = new ServiceRepository(deps.database);

  // 2. Use Cases (Categories)
  const createCategoryUseCase = new CreateCategoryUseCase(categoryRepo);
  const getCategoriesUseCase = new GetCategoriesUseCase(categoryRepo);
  const updateCategoryUseCase = new UpdateCategoryUseCase(categoryRepo);
  const deactivateCategoryUseCase = new DeactivateCategoryUseCase(categoryRepo);

  // 3. Use Cases (Services)
  const createServiceUseCase = new CreateServiceUseCase(serviceRepo, categoryRepo);
  const getServiceByIdUseCase = new GetServiceByIdUseCase(serviceRepo);
  const getServicesUseCase = new GetServicesUseCase(serviceRepo);
  const updateServiceUseCase = new UpdateServiceUseCase(serviceRepo, categoryRepo);
  const deactivateServiceUseCase = new DeactivateServiceUseCase(serviceRepo);
  const assignServiceToBranchUseCase = new AssignServiceToBranchUseCase(serviceRepo);
  const unassignServiceFromBranchUseCase = new UnassignServiceFromBranchUseCase(serviceRepo);
  const getServiceBranchAssignmentsUseCase = new GetServiceBranchAssignmentsUseCase(serviceRepo);

  // 4. Controllers
  const categoryController = new ServiceCategoryController(
    createCategoryUseCase,
    getCategoriesUseCase,
    updateCategoryUseCase,
    deactivateCategoryUseCase,
  );

  const serviceController = new ServiceController(
    createServiceUseCase,
    getServiceByIdUseCase,
    getServicesUseCase,
    updateServiceUseCase,
    deactivateServiceUseCase,
    assignServiceToBranchUseCase,
    unassignServiceFromBranchUseCase,
    getServiceBranchAssignmentsUseCase,
  );

  // 5. Routers
  const router = Router({ mergeParams: true });

  // Common middleware for all service routes
  router.use(deps.authMiddleware);
  router.use(deps.tenantMiddleware);

  // --- Category Routes ---
  const categoryRouter = Router({ mergeParams: true });
  categoryRouter.post(
    '/',
    deps.requirePermission('service.create'),
    categoryController.createCategory,
  );
  categoryRouter.get('/', deps.requirePermission('service.read'), categoryController.getCategories);
  categoryRouter.patch(
    '/:categoryId',
    deps.requirePermission('service.update'),
    categoryController.updateCategory,
  );
  categoryRouter.delete(
    '/:categoryId',
    deps.requirePermission('service.delete'),
    categoryController.deactivateCategory,
  );

  // --- Service Routes ---
  const serviceResourceRouter = Router({ mergeParams: true });
  serviceResourceRouter.post(
    '/',
    deps.requirePermission('service.create'),
    serviceController.createService,
  );
  serviceResourceRouter.get(
    '/',
    deps.requirePermission('service.read'),
    serviceController.getServices,
  );
  serviceResourceRouter.get(
    '/:serviceId',
    deps.requirePermission('service.read'),
    serviceController.getServiceById,
  );
  serviceResourceRouter.patch(
    '/:serviceId',
    deps.requirePermission('service.update'),
    serviceController.updateService,
  );
  serviceResourceRouter.delete(
    '/:serviceId',
    deps.requirePermission('service.delete'),
    serviceController.deactivateService,
  );

  // --- Branch Assignment Routes (Nested under Service) ---
  serviceResourceRouter.post(
    '/:serviceId/branches',
    deps.requirePermission('service.update'),
    serviceController.assignToBranch,
  );
  serviceResourceRouter.get(
    '/:serviceId/branches',
    deps.requirePermission('service.read'),
    serviceController.getBranchAssignments,
  );
  serviceResourceRouter.delete(
    '/:serviceId/branches/:branchId',
    deps.requirePermission('service.update'),
    serviceController.unassignFromBranch,
  );

  // Mount routers to the root module router
  router.use('/service-categories', categoryRouter);
  router.use('/services', serviceResourceRouter);

  return router;
}
