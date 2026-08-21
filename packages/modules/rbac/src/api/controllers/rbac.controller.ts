import { getTenantContext, getUuidParam, validateBody } from '@salon/shared';
import type { NextFunction, Request, Response } from 'express';
import type { CreateCustomRoleUseCase } from '../../application/use-cases/create-custom-role.use-case.js';
import type { GetBusinessRolesUseCase } from '../../application/use-cases/get-business-roles.use-case.js';
import type { GetPermissionsCatalogUseCase } from '../../application/use-cases/get-permissions-catalog.use-case.js';
import type { UpdateRolePermissionsUseCase } from '../../application/use-cases/update-role-permissions.use-case.js';
import { createRoleSchema } from '../dtos/create-role.schema.js';
import { updateRolePermissionsSchema } from '../dtos/update-role-permissions.schema.js';

export class RbacController {
  constructor(
    private readonly getPermissionsCatalogUseCase: GetPermissionsCatalogUseCase,
    private readonly getBusinessRolesUseCase: GetBusinessRolesUseCase,
    private readonly createCustomRoleUseCase: CreateCustomRoleUseCase,
    private readonly updateRolePermissionsUseCase: UpdateRolePermissionsUseCase,
  ) {}

  /**
   * Returns the system-wide permissions catalog with human-readable descriptions and modules.
   *
   * @http GET /api/v1/rbac/permissions
   * @headers
   *   - Authorization: Bearer <accessToken>
   *
   * @flow
   *   Client -> authMiddleware
   *          -> RbacController.getPermissions
   *          -> GetPermissionsCatalogUseCase.execute
   *          -> RbacRepository.getPermissionsCatalog
   *
   * @returns 200 OK { success: true, data: { permissions: [ { code, name, description, module } ] }, meta: { total } }
   * @throws 401 Unauthorized
   */
  getPermissions = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const catalog = await this.getPermissionsCatalogUseCase.execute();

      res.status(200).json({
        success: true,
        data: {
          permissions: catalog,
        },
        meta: {
          total: catalog.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Returns all custom and system roles defined for the authenticated business tenant.
   *
   * @http GET /api/v1/businesses/:businessId/roles
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware
   *          -> RbacController.getRoles
   *          -> GetBusinessRolesUseCase.execute(businessId)
   *          -> RbacRepository.getBusinessRoles
   *
   * @returns 200 OK { success: true, data: { roles: [ ... ] }, meta: { total } }
   * @throws 401 Unauthorized
   * @throws 403 Forbidden (Cross-tenant access)
   */
  getRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = getTenantContext(req);

      const roles = await this.getBusinessRolesUseCase.execute(businessId);

      res.status(200).json({
        success: true,
        data: {
          roles: roles.map((r) => r.toPrimitives()),
        },
        meta: {
          total: roles.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Creates a new custom role with assigned permission codes for the business tenant.
   *
   * @http POST /api/v1/businesses/:businessId/roles
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   * @body
   *   - name: string (1-100 chars)
   *   - description?: string
   *   - permissions: string[] (valid permission codes from the catalog)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('rbac.manage')
   *          -> RbacController.createRole
   *          -> validateBody(createRoleSchema)
   *          -> CreateCustomRoleUseCase.execute
   *          -> RbacRepository.createCustomRole (transaction: role + role_permissions)
   *
   * @returns 201 Created { success: true, data: { role: { id, name, isSystem, permissions } }, meta: {} }
   * @throws 400 Bad Request (Invalid permission codes / validation error)
   * @throws 401 Unauthorized
   * @throws 403 Forbidden
   * @throws 409 Conflict (Role name already exists in this business)
   */
  createRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = getTenantContext(req);
      const data = validateBody(createRoleSchema, req.body, 'Invalid role data');

      const role = await this.createCustomRoleUseCase.execute({
        businessId,
        name: data.name,
        description: data.description,
        permissionCodes: data.permissions,
      });

      res.status(201).json({
        success: true,
        data: {
          role: role.toPrimitives(),
        },
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Updates permission allocations for an existing custom role.
   *
   * @http PUT /api/v1/businesses/:businessId/roles/:roleId/permissions
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :roleId (UUID)
   * @body
   *   - permissions: string[]
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('rbac.manage')
   *          -> RbacController.updateRolePermissions
   *          -> validateBody(updateRolePermissionsSchema)
   *          -> UpdateRolePermissionsUseCase.execute
   *          -> RbacRepository.updateRolePermissions (transaction: DELETE old + batch INSERT new)
   *
   * @returns 200 OK { success: true, data: { role: { ... } }, meta: {} }
   * @throws 400 Bad Request
   * @throws 403 Forbidden (Attempting to modify protected system role e.g. Owner)
   * @throws 404 Not Found (Role not found)
   */
  updateRolePermissions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { businessId } = getTenantContext(req);
      const roleId = getUuidParam(req, 'roleId');
      const data = validateBody(updateRolePermissionsSchema, req.body, 'Invalid permissions array');

      const role = await this.updateRolePermissionsUseCase.execute(
        roleId,
        businessId,
        data.permissions,
      );

      res.status(200).json({
        success: true,
        data: {
          role: role.toPrimitives(),
        },
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  };
}
