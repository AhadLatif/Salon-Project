import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from '@salon/validation';
import { publicBusinessProfileSchema } from '../dtos/public-business.schema.js';

export const marketplaceOpenApiRegistry = new OpenAPIRegistry();

const errorSchema = z.object({
  code: z.string().openapi({ example: 'TOO_MANY_REQUESTS' }),
  message: z.string().openapi({ example: 'Too many requests' }),
  details: z.record(z.string(), z.string()).optional(),
});

const successEnvelopeSchema = <T extends z.ZodTypeAny>(
  dataSchema: T,
  metaSchema: z.ZodTypeAny = z.object({}),
) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    error: z.null().optional(),
    meta: metaSchema,
  });

const failureEnvelopeSchema = z.object({
  success: z.literal(false),
  error: errorSchema,
  meta: z.object({}),
});

marketplaceOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/marketplace/ping',
  summary: 'Marketplace public ping',
  description: 'Anonymous ping endpoint to test marketplace ingress and optional auth.',
  tags: ['Marketplace (public)'],
  security: [], // Public endpoint: no auth required
  responses: {
    200: {
      description: 'Successful ping',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(
            z.object({
              message: z.string().openapi({ example: 'Pong! Welcome anonymous guest' }),
              userId: z.string().uuid().optional(),
            }),
          ),
        },
      },
    },
    429: {
      description: 'Too many requests',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

marketplaceOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/marketplace/businesses/{slug}',
  summary: 'Get public business profile',
  description: 'Fetches the public profile of a salon, including active branches, by its URL slug.',
  tags: ['Marketplace (public)'],
  security: [],
  request: {
    params: z.object({
      slug: z
        .string()
        .openapi({ description: 'The unique slug of the business', example: 'fancy-cuts' }),
    }),
  },
  responses: {
    200: {
      description: 'Business profile successfully retrieved',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(publicBusinessProfileSchema),
        },
      },
    },
    404: {
      description: 'Salon not found',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    429: {
      description: 'Too many requests',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});
marketplaceOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/marketplace/businesses',
  summary: 'List public businesses',
  description: 'Fetches a paginated list of all active, published salons.',
  tags: ['Marketplace (public)'],
  security: [],
  request: {
    query: z.object({
      limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(50)
        .default(20)
        .openapi({ description: 'Max items per page (hard cap 50)' }),
      offset: z.coerce
        .number()
        .int()
        .min(0)
        .default(0)
        .openapi({ description: 'Number of items to skip' }),
    }),
  },
  responses: {
    200: {
      description: 'Paginated list of businesses',
      content: {
        'application/json': {
          // Response conforms to the platform's standard collection envelope where `data` holds
          // the array of matching business profiles and `meta` conveys pagination counters.
          schema: successEnvelopeSchema(
            z.array(publicBusinessProfileSchema),
            z.object({
              total: z.number().int().min(0).openapi({ description: 'Total published businesses' }),
              limit: z
                .number()
                .int()
                .min(1)
                .openapi({ description: 'Max items per page (hard cap 50)' }),
              offset: z.number().int().min(0).openapi({ description: 'Number of items skipped' }),
            }),
          ),
        },
      },
    },
    400: {
      description: 'Invalid pagination parameters',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    429: {
      description: 'Too many requests',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});
