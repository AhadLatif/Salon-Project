import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from '@salon/validation';
import { createRoleSchema } from '../dtos/create-role.schema.js';
import { updateRolePermissionsSchema } from '../dtos/update-role-permissions.schema.js';

export const rbacOpenApiRegistry = new OpenAPIRegistry();

const errorDetailsSchema = z.record(z.string(), z.string());
const errorSchema = z.object({
  code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
  message: z.string().openapi({ example: 'Invalid role data' }),
  details: errorDetailsSchema,
});
const successEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.object({}),
  });
const failureEnvelopeSchema = z.object({
  success: z.literal(false),
  error: errorSchema,
  data: z.null(),
  meta: z.object({}),
});

const permissionSchema = z.object({
  id: z.string().uuid(),
  code: z.string().openapi({ example: 'business.read' }),
  module: z.string().openapi({ example: 'business' }),
  name: z.string().openapi({ example: 'Read Business' }),
  description: z.string().openapi({ example: 'Allows viewing business details' }),
});

const roleSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  name: z.string().openapi({ example: 'Manager' }),
  description: z.string().nullable().openapi({ example: 'Salon Manager' }),
  isSystem: z.boolean(),
  displayOrder: z.number(),
  permissions: z.array(z.string()).openapi({ example: ['business.read', 'staff.manage'] }),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// GET /api/v1/businesses/permissions/catalog
rbacOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/businesses/permissions/catalog',
  summary: 'Get all available system permissions catalog',
  description: 'Retrieves the complete catalog of permissions available across all modules.',
  tags: ['RBAC'],
  responses: {
    200: {
      description: 'Permissions catalog retrieved successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(
            z.object({
              permissions: z.array(permissionSchema),
            }),
          ),
        },
      },
    },
    401: {
      description: 'Unauthorized (missing or invalid access token)',
      content: {
        'application/json': {
          schema: failureEnvelopeSchema,
        },
      },
    },
  },
});

// GET /api/v1/businesses/{id}/roles
rbacOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/businesses/{id}/roles',
  summary: 'Get all roles for a business',
  description: 'Retrieves all custom and system roles defined for the specified business tenant.',
  tags: ['RBAC'],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({ example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' }),
    }),
  },
  responses: {
    200: {
      description: 'Business roles retrieved successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(
            z.object({
              roles: z.array(roleSchema),
            }),
          ),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: failureEnvelopeSchema,
        },
      },
    },
    403: {
      description: 'Forbidden (insufficient permissions or tenant access)',
      content: {
        'application/json': {
          schema: failureEnvelopeSchema,
        },
      },
    },
  },
});

// POST /api/v1/businesses/{id}/roles
rbacOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/businesses/{id}/roles',
  summary: 'Create a custom role',
  description: 'Creates a new custom role with assigned permissions for the business tenant.',
  tags: ['RBAC'],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({ example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: createRoleSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Custom role created successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(
            z.object({
              role: roleSchema,
            }),
          ),
        },
      },
    },
    400: {
      description: 'Validation Error or Unknown Permission Code',
      content: {
        'application/json': {
          schema: failureEnvelopeSchema,
        },
      },
    },
    403: {
      description: 'Forbidden (insufficient permissions)',
      content: {
        'application/json': {
          schema: failureEnvelopeSchema,
        },
      },
    },
  },
});

// PATCH /api/v1/businesses/{id}/roles/{roleId}
rbacOpenApiRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/businesses/{id}/roles/{roleId}',
  summary: 'Update role permissions',
  description: 'Replaces the permission matrix for a specific custom role.',
  tags: ['RBAC'],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({ example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' }),
      roleId: z.string().uuid().openapi({ example: '11111111-2222-3333-4444-555555555555' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: updateRolePermissionsSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Role permissions updated successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(
            z.object({
              role: roleSchema,
            }),
          ),
        },
      },
    },
    400: {
      description: 'Validation Error',
      content: {
        'application/json': {
          schema: failureEnvelopeSchema,
        },
      },
    },
    404: {
      description: 'Role Not Found',
      content: {
        'application/json': {
          schema: failureEnvelopeSchema,
        },
      },
    },
  },
});
