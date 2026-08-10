import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from '@salon/validation';
import { createBusinessSchema } from '../dtos/create-business.schema.js';

export const businessOpenApiRegistry = new OpenAPIRegistry();

const errorDetailsSchema = z.record(z.string(), z.string());
const errorSchema = z.object({
  code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
  message: z.string().openapi({ example: 'Invalid business data' }),
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

const businessResponseSchema = z.object({
  business: z.object({
    id: z.string().uuid().openapi({ example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' }),
    slug: z.string().openapi({ example: 'johns-barbershop' }),
    name: z.string().openapi({ example: "John's Barbershop" }),
    description: z.string().nullable().openapi({ example: 'Best cuts in town' }),
    email: z.string().email().openapi({ example: 'hello@johns-barbershop.com' }),
    phoneNumber: z.string().openapi({ example: '+1234567890' }),
    status: z.string().openapi({ example: 'pending' }),
    socialLinks: z.record(z.string(), z.string()).nullable(),
    verifiedAt: z.date().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
});

businessOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/businesses',
  summary: 'Create a new business',
  description: 'Creates a new business with the authenticated user as Owner.',
  tags: ['Business'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: createBusinessSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Business successfully created',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(businessResponseSchema),
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
    409: {
      description: 'Conflict Error (slug already exists)',
      content: {
        'application/json': {
          schema: failureEnvelopeSchema,
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
