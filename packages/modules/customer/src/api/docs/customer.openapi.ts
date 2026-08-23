import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from '@salon/validation';
import { addFavoriteSchema } from '../dtos/add-favorite.schema.js';
import { assignCustomerTagSchema } from '../dtos/assign-customer-tag.schema.js';
import { createCustomerSchema } from '../dtos/create-customer.schema.js';
import { createCustomerNoteSchema } from '../dtos/create-customer-note.schema.js';
import { createCustomerTagSchema } from '../dtos/create-customer-tag.schema.js';
import { updateCustomerSchema } from '../dtos/update-customer.schema.js';

export const customerOpenApiRegistry = new OpenAPIRegistry();

customerOpenApiRegistry.registerComponent('securitySchemes', 'bearerAuth', {
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
const successEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T, metaSchema?: z.ZodTypeAny) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: metaSchema ?? z.object({}),
    error: z.null().optional(),
  });
const failureEnvelopeSchema = z.object({
  success: z.literal(false),
  error: errorSchema,
  data: z.null(),
  meta: z.object({}),
});

const customerResponseSchema = z
  .object({
    id: z.uuid(),
    businessId: z.uuid(),
    userId: z.uuid().nullable(),
    firstName: z.string(),
    lastName: z.string().nullable(),
    phoneNumber: z.string().nullable(),
    email: z.string().nullable(),
    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
    dateOfBirth: z.string().nullable(),
    status: z.enum(['active', 'blocked', 'archived']),
    marketingOptIn: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('BusinessCustomer');

const customerTagResponseSchema = z
  .object({
    id: z.uuid(),
    businessId: z.uuid(),
    name: z.string(),
    color: z.string().nullable(),
    description: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('CustomerTag');

const customerTagAssignmentResponseSchema = z
  .object({
    businessId: z.uuid(),
    businessCustomerId: z.uuid(),
    customerTagId: z.uuid(),
    assignedBy: z.uuid().nullable(),
    assignedAt: z.string().datetime(),
  })
  .openapi('CustomerTagAssignment');

const customerWithTagsResponseSchema = customerResponseSchema
  .extend({
    tags: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        color: z.string().nullable(),
        description: z.string().nullable(),
        assignedAt: z.string().datetime(),
      }),
    ),
  })
  .openapi('CustomerWithTags');

const customerNoteResponseSchema = z
  .object({
    id: z.uuid(),
    businessId: z.uuid(),
    businessCustomerId: z.uuid(),
    authorId: z.uuid().nullable(),
    note: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('CustomerNote');

const customerFavoriteResponseSchema = z
  .object({
    id: z.uuid(),
    userId: z.uuid(),
    businessId: z.uuid().nullable(),
    staffMemberId: z.uuid().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi('CustomerFavorite');

// --- CUSTOMER CRM PATHS ---

// POST /api/v1/businesses/{businessId}/customers
customerOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/businesses/{businessId}/customers',
  summary: 'Create a new customer profile in salon CRM',
  tags: ['Customer CRM'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ businessId: z.uuid() }),
    body: { content: { 'application/json': { schema: createCustomerSchema } } },
  },
  responses: {
    201: {
      description: 'Customer profile created successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ customer: customerResponseSchema })),
        },
      },
    },
    400: {
      description: 'Validation failed',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    409: {
      description: 'Email already exists in salon directory',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

// GET /api/v1/businesses/{businessId}/customers
customerOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/businesses/{businessId}/customers',
  summary: 'List & search customers with pagination',
  tags: ['Customer CRM'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ businessId: z.uuid() }),
    query: z.object({
      page: z.coerce.number().optional(),
      limit: z.coerce.number().optional(),
      search: z.string().optional(),
      status: z.enum(['active', 'blocked', 'archived']).optional(),
      tagId: z.uuid().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Customers retrieved successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(
            z.object({ customers: z.array(customerResponseSchema), total: z.number() }),
            z.object({ page: z.number(), limit: z.number() }),
          ),
        },
      },
    },
  },
});

// GET /api/v1/businesses/{businessId}/customers/{customerId}
customerOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/businesses/{businessId}/customers/{customerId}',
  summary: 'Get customer profile details and assigned tags',
  tags: ['Customer CRM'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ businessId: z.uuid(), customerId: z.uuid() }),
  },
  responses: {
    200: {
      description: 'Customer details retrieved',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ customer: customerWithTagsResponseSchema })),
        },
      },
    },
    404: {
      description: 'Customer not found',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

// PATCH /api/v1/businesses/{businessId}/customers/{customerId}
customerOpenApiRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/businesses/{businessId}/customers/{customerId}',
  summary: 'Update customer profile',
  tags: ['Customer CRM'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ businessId: z.uuid(), customerId: z.uuid() }),
    body: { content: { 'application/json': { schema: updateCustomerSchema } } },
  },
  responses: {
    200: {
      description: 'Customer updated successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ customer: customerResponseSchema })),
        },
      },
    },
    404: {
      description: 'Customer not found',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

// DELETE /api/v1/businesses/{businessId}/customers/{customerId}
customerOpenApiRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/businesses/{businessId}/customers/{customerId}',
  summary: 'Soft-archive customer profile',
  tags: ['Customer CRM'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ businessId: z.uuid(), customerId: z.uuid() }),
  },
  responses: {
    200: {
      description: 'Customer archived successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ customer: customerResponseSchema })),
        },
      },
    },
    404: {
      description: 'Customer not found',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

// --- NOTES PATHS ---

// POST /api/v1/businesses/{businessId}/customers/{customerId}/notes
customerOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/businesses/{businessId}/customers/{customerId}/notes',
  summary: 'Add internal CRM note for a customer',
  tags: ['Customer Notes'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ businessId: z.uuid(), customerId: z.uuid() }),
    body: { content: { 'application/json': { schema: createCustomerNoteSchema } } },
  },
  responses: {
    201: {
      description: 'Note created successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ note: customerNoteResponseSchema })),
        },
      },
    },
  },
});

// GET /api/v1/businesses/{businessId}/customers/{customerId}/notes
customerOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/businesses/{businessId}/customers/{customerId}/notes',
  summary: 'List internal CRM notes for a customer',
  tags: ['Customer Notes'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ businessId: z.uuid(), customerId: z.uuid() }),
  },
  responses: {
    200: {
      description: 'Notes retrieved successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ notes: z.array(customerNoteResponseSchema) })),
        },
      },
    },
  },
});

// DELETE /api/v1/businesses/{businessId}/customers/{customerId}/notes/{noteId}
customerOpenApiRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/businesses/{businessId}/customers/{customerId}/notes/{noteId}',
  summary: 'Delete a customer note',
  tags: ['Customer Notes'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ businessId: z.uuid(), customerId: z.uuid(), noteId: z.uuid() }),
  },
  responses: {
    200: {
      description: 'Note deleted',
      content: {
        'application/json': { schema: successEnvelopeSchema(z.object({ deleted: z.boolean() })) },
      },
    },
  },
});

// --- TAGS PATHS ---

// POST /api/v1/businesses/{businessId}/customer-tags
customerOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/businesses/{businessId}/customer-tags',
  summary: 'Create a new business customer tag',
  tags: ['Customer Tags'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ businessId: z.uuid() }),
    body: { content: { 'application/json': { schema: createCustomerTagSchema } } },
  },
  responses: {
    201: {
      description: 'Tag created successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ tag: customerTagResponseSchema })),
        },
      },
    },
  },
});

// GET /api/v1/businesses/{businessId}/customer-tags
customerOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/businesses/{businessId}/customer-tags',
  summary: 'List all tags defined in business',
  tags: ['Customer Tags'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ businessId: z.uuid() }),
  },
  responses: {
    200: {
      description: 'Tags retrieved successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ tags: z.array(customerTagResponseSchema) })),
        },
      },
    },
  },
});

// DELETE /api/v1/businesses/{businessId}/customer-tags/{tagId}
customerOpenApiRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/businesses/{businessId}/customer-tags/{tagId}',
  summary: 'Delete a customer tag from business catalog',
  tags: ['Customer Tags'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ businessId: z.uuid(), tagId: z.uuid() }),
  },
  responses: {
    200: {
      description: 'Tag deleted',
      content: {
        'application/json': { schema: successEnvelopeSchema(z.object({ deleted: z.boolean() })) },
      },
    },
  },
});

// POST /api/v1/businesses/{businessId}/customers/{customerId}/tags
customerOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/businesses/{businessId}/customers/{customerId}/tags',
  summary: 'Assign a tag to customer',
  tags: ['Customer Tags'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ businessId: z.uuid(), customerId: z.uuid() }),
    body: { content: { 'application/json': { schema: assignCustomerTagSchema } } },
  },
  responses: {
    201: {
      description: 'Tag assigned successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(
            z.object({ assignment: customerTagAssignmentResponseSchema }),
          ),
        },
      },
    },
  },
});

// DELETE /api/v1/businesses/{businessId}/customers/{customerId}/tags/{tagId}
customerOpenApiRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/businesses/{businessId}/customers/{customerId}/tags/{tagId}',
  summary: 'Unassign tag from customer',
  tags: ['Customer Tags'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ businessId: z.uuid(), customerId: z.uuid(), tagId: z.uuid() }),
  },
  responses: {
    200: {
      description: 'Tag unassigned',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ unassigned: z.boolean() })),
        },
      },
    },
  },
});

// --- FAVORITES PATHS ---

// POST /api/v1/favorites
customerOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/favorites',
  summary: 'Add a salon or staff member to favorites',
  tags: ['Customer Favorites'],
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: addFavoriteSchema } } },
  },
  responses: {
    201: {
      description: 'Favorite saved',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ favorite: customerFavoriteResponseSchema })),
        },
      },
    },
  },
});

// GET /api/v1/favorites
customerOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/favorites',
  summary: 'List current user favorites',
  tags: ['Customer Favorites'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Favorites list',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(
            z.object({ favorites: z.array(customerFavoriteResponseSchema) }),
          ),
        },
      },
    },
  },
});

// DELETE /api/v1/favorites/{favoriteId}
customerOpenApiRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/favorites/{favoriteId}',
  summary: 'Remove saved favorite',
  tags: ['Customer Favorites'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ favoriteId: z.uuid() }),
  },
  responses: {
    200: {
      description: 'Favorite removed',
      content: {
        'application/json': { schema: successEnvelopeSchema(z.object({ deleted: z.boolean() })) },
      },
    },
  },
});
