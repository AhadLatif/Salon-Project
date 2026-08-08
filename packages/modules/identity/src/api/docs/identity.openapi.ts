import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from '@salon/validation';
import { registerUserSchema } from '../dtos/register-user.schema.js';

export const identityOpenApiRegistry = new OpenAPIRegistry();

// --- Shared Error Envelope (per coding guidelines: { success, error, meta }) ---
// error.details is ALWAYS a Record<string, string> (object), never an array.

const errorDetailsSchema = z.record(z.string(), z.string());
const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: errorDetailsSchema,
});
const envelopeSchema = z.object({
  success: z.boolean(),
  error: errorSchema.nullable(), // null on success, present on failure
  meta: z.object({}),
});

// Register HTTP Route: POST /api/v1/auth/register
identityOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/register',
  summary: 'Register a new user account',
  description:
    'Creates a core user record, links email authentication, and establishes an initial session.',
  tags: ['Identity & Authentication'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: registerUserSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'User successfully created and authenticated',
      content: {
        'application/json': {
          schema: envelopeSchema.extend({
            data: z.object({
              user: z.object({
                id: z.string().uuid().openapi({ example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' }),
                email: z.string().email().openapi({ example: 'john.doe@example.com' }),
                fullName: z.string().openapi({ example: 'John Doe' }),
              }),
              tokens: z.object({
                accessToken: z.string().openapi({ example: 'eyJhbGciOiJIUzI1Ni...' }),
                refreshToken: z.string().openapi({ example: 'd8a2f1...raw_refresh_token' }),
              }),
            }),
          }),
        },
      },
    },
    400: {
      description: 'Validation Error (Invalid request body)',
      content: {
        'application/json': {
          schema: envelopeSchema.extend({
            success: z.literal(false),
            error: errorSchema.required(),
            data: z.null(),
          }),
        },
      },
    },
    409: {
      description: 'Conflict Error (Email already registered)',
      content: {
        'application/json': {
          schema: envelopeSchema.extend({
            success: z.literal(false),
            error: errorSchema.required(),
            data: z.null(),
          }),
        },
      },
    },
  },
});

// Export the shared schemas for reuse across module registries.
export { envelopeSchema, errorDetailsSchema, errorSchema };
