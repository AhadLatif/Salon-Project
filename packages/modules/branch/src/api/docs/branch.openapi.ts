import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from '@salon/validation';
import { createBranchSchema, openingHourSchema } from '../dtos/create-branch.schema.js';
import { updateBranchSchema } from '../dtos/update-branch.schema.js';
import { updateBranchHoursSchema } from '../dtos/update-branch-hours.schema.js';

export const branchOpenApiRegistry = new OpenAPIRegistry();

branchOpenApiRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

const errorDetailsSchema = z.record(z.string(), z.string());
const errorSchema = z.object({
  code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
  message: z.string().openapi({ example: 'Invalid branch data' }),
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

const branchResponseSchema = z
  .object({
    id: z.string().uuid(),
    businessId: z.string().uuid(),
    name: z.string(),
    phoneNumber: z.string().nullable(),
    email: z.string().nullable(),
    timezone: z.string(),
    currency: z.string(),
    addressLine1: z.string(),
    addressLine2: z.string().nullable(),
    city: z.string(),
    state: z.string().nullable(),
    postalCode: z.string().nullable(),
    countryCode: z.string(),
    latitude: z.string().nullable(),
    longitude: z.string().nullable(),
    status: z.enum(['active', 'inactive', 'archived']),
    openingHours: z.array(openingHourSchema),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .openapi('Branch');

// GET /api/v1/businesses/{id}/branches
branchOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/businesses/{id}/branches',
  summary: 'Get all branches for a business',
  description: 'Retrieves all branches and their opening hours for the specified business tenant.',
  tags: ['Branch'],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({ example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' }),
    }),
  },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Branches retrieved successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ branches: z.array(branchResponseSchema) })),
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

// GET /api/v1/businesses/{id}/branches/{branchId}
branchOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/businesses/{id}/branches/{branchId}',
  summary: 'Get branch by ID',
  tags: ['Branch'],
  request: {
    params: z.object({
      id: z.string().uuid(),
      branchId: z.string().uuid(),
    }),
  },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Branch retrieved successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ branch: branchResponseSchema })),
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

// POST /api/v1/businesses/{id}/branches
branchOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/businesses/{id}/branches',
  summary: 'Create a new branch',
  description: 'Creates a new branch including its mandatory weekly opening hours.',
  tags: ['Branch'],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: createBranchSchema } } },
  },
  security: [{ bearerAuth: [] }],
  responses: {
    201: {
      description: 'Branch created successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ branch: branchResponseSchema })),
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
  },
});

// PATCH /api/v1/businesses/{id}/branches/{branchId}
branchOpenApiRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/businesses/{id}/branches/{branchId}',
  summary: 'Update branch details',
  tags: ['Branch'],
  request: {
    params: z.object({ id: z.string().uuid(), branchId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: updateBranchSchema } } },
  },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Branch updated successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ branch: branchResponseSchema })),
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
  },
});

// PUT /api/v1/businesses/{id}/branches/{branchId}/hours
branchOpenApiRegistry.registerPath({
  method: 'put',
  path: '/api/v1/businesses/{id}/branches/{branchId}/hours',
  summary: 'Update branch opening hours',
  description: 'Completely replaces the branch opening hours matrix.',
  tags: ['Branch'],
  request: {
    params: z.object({ id: z.string().uuid(), branchId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: updateBranchHoursSchema } } },
  },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Hours updated successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ branch: branchResponseSchema })),
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
  },
});

// DELETE /api/v1/businesses/{id}/branches/{branchId}
branchOpenApiRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/businesses/{id}/branches/{branchId}',
  summary: 'Delete a branch',
  tags: ['Branch'],
  request: {
    params: z.object({ id: z.string().uuid(), branchId: z.string().uuid() }),
  },
  security: [{ bearerAuth: [] }],
  responses: {
    204: {
      description: 'Branch deleted successfully',
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
