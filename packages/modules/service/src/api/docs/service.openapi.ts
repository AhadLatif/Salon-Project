import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from '@salon/validation';
import { assignBranchSchema } from '../dtos/assign-branch.schema.js';
import { createCategorySchema } from '../dtos/create-category.schema.js';
import { createServiceSchema } from '../dtos/create-service.schema.js';
import { updateCategorySchema } from '../dtos/update-category.schema.js';
import { updateServiceSchema } from '../dtos/update-service.schema.js';

export const serviceOpenApiRegistry = new OpenAPIRegistry();

serviceOpenApiRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

const errorDetailsSchema = z.record(z.string(), z.string());
const errorSchema = z.object({
  code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
  message: z.string().openapi({ example: 'Invalid request data' }),
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

// --- Category Schemas ---

const categoryResponseSchema = z
  .object({
    id: z.uuid(),
    businessId: z.uuid(),
    name: z.string(),
    description: z.string().nullable(),
    displayOrder: z.number().int(),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('ServiceCategory');

// GET /api/v1/businesses/{id}/service-categories
serviceOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/businesses/{id}/service-categories',
  summary: 'Get all service categories for a business',
  tags: ['Service Category'],
  request: {
    params: z.object({
      id: z.uuid(),
    }),
    query: z.object({
      includeInactive: z
        .string()
        .optional()
        .openapi({ example: 'true', description: 'Include deactivated categories' }),
    }),
  },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Categories retrieved successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ categories: z.array(categoryResponseSchema) })),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

// POST /api/v1/businesses/{id}/service-categories
serviceOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/businesses/{id}/service-categories',
  summary: 'Create a new service category',
  tags: ['Service Category'],
  request: {
    params: z.object({ id: z.uuid() }),
    body: { content: { 'application/json': { schema: createCategorySchema } } },
  },
  security: [{ bearerAuth: [] }],
  responses: {
    201: {
      description: 'Category created successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ category: categoryResponseSchema })),
        },
      },
    },
    400: {
      description: 'Validation Error',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    409: {
      description: 'Conflict (Duplicate Name)',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

// PATCH /api/v1/businesses/{id}/service-categories/{categoryId}
serviceOpenApiRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/businesses/{id}/service-categories/{categoryId}',
  summary: 'Update a service category',
  tags: ['Service Category'],
  request: {
    params: z.object({ id: z.string().uuid(), categoryId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: updateCategorySchema } } },
  },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Category updated successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ category: categoryResponseSchema })),
        },
      },
    },
    400: {
      description: 'Validation Error',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    404: {
      description: 'Not Found',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    409: {
      description: 'Conflict (Duplicate Name)',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

// DELETE /api/v1/businesses/{id}/service-categories/{categoryId}
serviceOpenApiRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/businesses/{id}/service-categories/{categoryId}',
  summary: 'Deactivate a service category',
  description: 'Soft-deletes the category by setting isActive to false.',
  tags: ['Service Category'],
  request: {
    params: z.object({ id: z.string().uuid(), categoryId: z.string().uuid() }),
  },
  security: [{ bearerAuth: [] }],
  responses: {
    204: { description: 'Category deactivated successfully' },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    404: {
      description: 'Not Found',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

// --- Service Schemas ---

const serviceResponseSchema = z
  .object({
    id: z.string().uuid(),
    businessId: z.string().uuid(),
    categoryId: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    defaultPrice: z.string(),
    defaultDurationMinutes: z.number().int(),
    bufferBeforeMinutes: z.number().int(),
    bufferAfterMinutes: z.number().int(),
    color: z.string().nullable(),
    isBookable: z.boolean(),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('Service');

// GET /api/v1/businesses/{id}/services
serviceOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/businesses/{id}/services',
  summary: 'Get all services for a business',
  tags: ['Service'],
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
    query: z.object({
      categoryId: z.string().uuid().optional(),
      includeInactive: z
        .string()
        .optional()
        .openapi({ example: 'true', description: 'Include deactivated services' }),
    }),
  },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Services retrieved successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ services: z.array(serviceResponseSchema) })),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

// GET /api/v1/businesses/{id}/services/{serviceId}
serviceOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/businesses/{id}/services/{serviceId}',
  summary: 'Get a specific service by ID',
  tags: ['Service'],
  request: {
    params: z.object({ id: z.string().uuid(), serviceId: z.string().uuid() }),
  },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Service retrieved successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ service: serviceResponseSchema })),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    404: {
      description: 'Not Found',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

// POST /api/v1/businesses/{id}/services
serviceOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/businesses/{id}/services',
  summary: 'Create a new service',
  tags: ['Service'],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: createServiceSchema } } },
  },
  security: [{ bearerAuth: [] }],
  responses: {
    201: {
      description: 'Service created successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ service: serviceResponseSchema })),
        },
      },
    },
    400: {
      description: 'Validation Error',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    403: {
      description: 'Forbidden (Category IDOR)',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    409: {
      description: 'Conflict (Duplicate Name)',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

// PATCH /api/v1/businesses/{id}/services/{serviceId}
serviceOpenApiRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/businesses/{id}/services/{serviceId}',
  summary: 'Update a service',
  tags: ['Service'],
  request: {
    params: z.object({ id: z.string().uuid(), serviceId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: updateServiceSchema } } },
  },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Service updated successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ service: serviceResponseSchema })),
        },
      },
    },
    400: {
      description: 'Validation Error',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    403: {
      description: 'Forbidden (Category IDOR)',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    404: {
      description: 'Not Found',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    409: {
      description: 'Conflict (Duplicate Name)',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

// DELETE /api/v1/businesses/{id}/services/{serviceId}
serviceOpenApiRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/businesses/{id}/services/{serviceId}',
  summary: 'Deactivate a service',
  description: 'Soft-deletes the service by setting isActive to false.',
  tags: ['Service'],
  request: {
    params: z.object({ id: z.string().uuid(), serviceId: z.string().uuid() }),
  },
  security: [{ bearerAuth: [] }],
  responses: {
    204: { description: 'Service deactivated successfully' },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    404: {
      description: 'Not Found',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

// --- Branch Assignment Schemas ---

// GET /api/v1/businesses/{id}/services/{serviceId}/branches
serviceOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/businesses/{id}/services/{serviceId}/branches',
  summary: 'Get branches where this service is available',
  tags: ['Service Assignment'],
  request: {
    params: z.object({ id: z.string().uuid(), serviceId: z.string().uuid() }),
  },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Branch assignments retrieved successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(
            z.object({
              serviceId: z.string().uuid(),
              assignments: z.array(
                z.object({
                  branchId: z.string().uuid(),
                  isBookable: z.boolean(),
                }),
              ),
            }),
          ),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

// POST /api/v1/businesses/{id}/services/{serviceId}/branches
serviceOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/businesses/{id}/services/{serviceId}/branches',
  summary: 'Assign a service to a branch',
  tags: ['Service Assignment'],
  request: {
    params: z.object({ id: z.string().uuid(), serviceId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: assignBranchSchema } } },
  },
  security: [{ bearerAuth: [] }],
  responses: {
    201: {
      description: 'Service assigned to branch successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(
            z.object({ branchId: z.string().uuid(), serviceId: z.string().uuid() }),
          ),
        },
      },
    },
    400: {
      description: 'Validation Error',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    403: {
      description: 'Forbidden (Branch/Service IDOR)',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    409: {
      description: 'Conflict (Already Assigned)',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

// DELETE /api/v1/businesses/{id}/services/{serviceId}/branches/{branchId}
serviceOpenApiRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/businesses/{id}/services/{serviceId}/branches/{branchId}',
  summary: 'Unassign a service from a branch',
  tags: ['Service Assignment'],
  request: {
    params: z.object({
      id: z.string().uuid(),
      serviceId: z.string().uuid(),
      branchId: z.string().uuid(),
    }),
  },
  security: [{ bearerAuth: [] }],
  responses: {
    204: { description: 'Service unassigned from branch successfully' },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    404: {
      description: 'Not Found',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});
