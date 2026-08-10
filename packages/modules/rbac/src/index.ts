import type { db } from '@salon/database';
import { type RequestHandler, Router } from 'express';
import { RbacController } from './api/controllers/rbac.controller.js';
import { createRequirePermissionMiddleware } from './api/middlewares/permission.middleware.js';
import { CreateCustomRoleUseCase } from './application/use-cases/create-custom-role.use-case.js';
import { GetBusinessRolesUseCase } from './application/use-cases/get-business-roles.use-case.js';
import { GetPermissionsCatalogUseCase } from './application/use-cases/get-permissions-catalog.use-case.js';
import { UpdateRolePermissionsUseCase } from './application/use-cases/update-role-permissions.use-case.js';
import { RbacRepository } from './infrastructure/repositories/rbac.repository.js';

// --- EXPORT ALL CLASSES & TYPES ---
export * from './api/controllers/rbac.controller.js';
export * from './api/docs/rbac.openapi.js';
export * from './api/dtos/create-role.schema.js';
export * from './api/dtos/update-role-permissions.schema.js';
export * from './api/middlewares/permission.middleware.js';
export * from './application/ports/rbac-repository.port.js';
export * from './application/use-cases/create-custom-role.use-case.js';
export * from './application/use-cases/get-business-roles.use-case.js';
export * from './application/use-cases/get-permissions-catalog.use-case.js';
export * from './application/use-cases/update-role-permissions.use-case.js';
export * from './domain/entities/role.entity.js';
export * from './infrastructure/repositories/rbac.repository.js';

export interface RbacModuleDependencies {
  database: typeof db;
  authMiddleware: RequestHandler;
  tenantMiddleware: RequestHandler;
}

export interface RbacModule {
  rbacRouter: Router;
  requirePermission: (permissionCode: string) => RequestHandler;
  useCases: {
    getPermissionsCatalogUseCase: GetPermissionsCatalogUseCase;
    getBusinessRolesUseCase: GetBusinessRolesUseCase;
    createCustomRoleUseCase: CreateCustomRoleUseCase;
    updateRolePermissionsUseCase: UpdateRolePermissionsUseCase;
  };
}

export function createRbacModule(deps: RbacModuleDependencies): RbacModule {
  const rbacRepository = new RbacRepository(deps.database);

  const getPermissionsCatalogUseCase = new GetPermissionsCatalogUseCase(rbacRepository);
  const getBusinessRolesUseCase = new GetBusinessRolesUseCase(rbacRepository);
  const createCustomRoleUseCase = new CreateCustomRoleUseCase(rbacRepository);
  const updateRolePermissionsUseCase = new UpdateRolePermissionsUseCase(rbacRepository);

  const requirePermission = createRequirePermissionMiddleware(rbacRepository);

  const rbacController = new RbacController(
    getPermissionsCatalogUseCase,
    getBusinessRolesUseCase,
    createCustomRoleUseCase,
    updateRolePermissionsUseCase,
  );

  const rbacRouter = Router();

  // Permission Catalog
  rbacRouter.get('/permissions/catalog', deps.authMiddleware, rbacController.getPermissions);

  // Role Management
  rbacRouter.get(
    '/:id/roles',
    deps.authMiddleware,
    deps.tenantMiddleware,
    requirePermission('business.roles.manage'),
    rbacController.getRoles,
  );
  rbacRouter.post(
    '/:id/roles',
    deps.authMiddleware,
    deps.tenantMiddleware,
    requirePermission('business.roles.manage'),
    rbacController.createRole,
  );
  rbacRouter.patch(
    '/:id/roles/:roleId',
    deps.authMiddleware,
    deps.tenantMiddleware,
    requirePermission('business.roles.manage'),
    rbacController.updateRolePermissions,
  );

  return {
    rbacRouter,
    requirePermission,
    useCases: {
      getPermissionsCatalogUseCase,
      getBusinessRolesUseCase,
      createCustomRoleUseCase,
      updateRolePermissionsUseCase,
    },
  };
}
