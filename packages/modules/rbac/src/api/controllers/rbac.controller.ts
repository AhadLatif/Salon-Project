import { ConflictError, ForbiddenError, ValidationError } from '@salon/shared';
import type { NextFunction, Request, Response } from 'express';
import type { CreateCustomRoleUseCase } from '../../application/use-cases/create-custom-role.use-case.js';
import type { GetBusinessRolesUseCase } from '../../application/use-cases/get-business-roles.use-case.js';
import type { GetPermissionsCatalogUseCase } from '../../application/use-cases/get-permissions-catalog.use-case.js';
import type { UpdateRolePermissionsUseCase } from '../../application/use-cases/update-role-permissions.use-case.js';
import { createRoleSchema } from '../dtos/create-role.schema.js';
import { updateRolePermissionsSchema } from '../dtos/update-role-permissions.schema.js';

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

export class RbacController {
  constructor(
    private readonly getPermissionsCatalogUseCase: GetPermissionsCatalogUseCase,
    private readonly getBusinessRolesUseCase: GetBusinessRolesUseCase,
    private readonly createCustomRoleUseCase: CreateCustomRoleUseCase,
    private readonly updateRolePermissionsUseCase: UpdateRolePermissionsUseCase,
  ) {}

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

  getRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const businessId = validateTenantConsistency(req);

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

  createRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const businessId = validateTenantConsistency(req);

      const parseResult = createRoleSchema.safeParse(req.body);

      if (!parseResult.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parseResult.error.issues) {
          const fieldName = issue.path.join('.');
          if (fieldName) {
            fieldErrors[fieldName] = issue.message;
          }
        }
        throw new ValidationError('Invalid role data', fieldErrors);
      }

      const role = await this.createCustomRoleUseCase.execute({
        businessId,
        name: parseResult.data.name,
        description: parseResult.data.description,
        permissionCodes: parseResult.data.permissions,
      });

      res.status(201).json({
        success: true,
        data: {
          role: role.toPrimitives(),
        },
        meta: {},
      });
    } catch (error) {
      const err = error as NodeJS.ErrnoException & {
        cause?: { code?: string; constraint?: string };
      };
      const code = err.cause?.code ?? err.code;
      const constraint = err.cause?.constraint;
      if (code === '23505' && constraint === 'uq_business_roles_name') {
        return next(new ConflictError('Role name already exists for this business.'));
      }
      next(error);
    }
  };

  updateRolePermissions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const businessId = validateTenantConsistency(req);
      const roleIdParam = req.params.roleId;
      const roleId = Array.isArray(roleIdParam) ? roleIdParam[0] : roleIdParam;

      if (!roleId) {
        throw new ValidationError('Missing role ID parameter', {
          roleId: 'Role ID is required',
        });
      }

      const parseResult = updateRolePermissionsSchema.safeParse(req.body);

      if (!parseResult.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parseResult.error.issues) {
          const fieldName = issue.path.join('.');
          if (fieldName) {
            fieldErrors[fieldName] = issue.message;
          }
        }
        throw new ValidationError('Invalid permissions array', fieldErrors);
      }

      const role = await this.updateRolePermissionsUseCase.execute(
        roleId,
        businessId,
        parseResult.data.permissions,
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
