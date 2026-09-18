import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from '@salon/validation';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from '../cookies/refresh-cookie.js';
import { loginSchema, refreshTokenSchema } from '../dtos/auth.schema.js';
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

// Reusable failure variant of the envelope, so every documented error looks identical.
const errorResponseSchema = envelopeSchema.extend({
  success: z.literal(false),
  error: errorSchema.required(),
  data: z.null(),
});

// --- Shared Success Payload Pieces ---

const authUserSchema = z.object({
  id: z.uuid().openapi({ example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' }),
  email: z.email().openapi({ example: 'john.doe@example.com' }),
  fullName: z.string().openapi({ example: 'John Doe' }),
});

/**
 * Access token: the ONLY token that travels in a response body. The client stores it in
 * memory and sends it back as `Authorization: Bearer <token>`.
 */
const accessTokenSchema = z
  .string()
  .openapi({ example: 'eyJhbGciOiJIUzI1Ni...', description: 'Short-lived (15 min) JWT.' });

/**
 * The refresh token is documented as a HEADER, never as a body field.
 *
 * This mirrors the security model exactly: the refresh token is HttpOnly and therefore
 * invisible to JavaScript. Documenting it in the body would invite a client to read it,
 * which is precisely what the model forbids.
 */
// zod-to-openapi accepts a ZodObject for response `headers`; its generator
// calls getResponseHeaders() which maps each entry through
// generateSimpleParameter(), extracting the openapi() metadata (description,
// example) and converting the Zod schema into a proper header Object at
// runtime — no type narrowing is needed.
const refreshCookieHeaderSchema = z.object({
  'Set-Cookie': z.string().openapi({
    description: [
      `Sets ${REFRESH_COOKIE_NAME}: HttpOnly, SameSite=Lax, Path=${REFRESH_COOKIE_PATH},`,
      'Secure in production, Max-Age = 7 days. This cookie — not the response body — carries the',
      'refresh token, so client-side JavaScript must never have access to it.',
    ].join(' '),
    example: `${REFRESH_COOKIE_NAME}=d8a2f1...; Path=${REFRESH_COOKIE_PATH}; HttpOnly; SameSite=Lax`,
  }),
});

const refreshCookieClearedHeaderSchema = z.object({
  'Set-Cookie': z.string().openapi({
    description: `Expires ${REFRESH_COOKIE_NAME} in the past so the browser stops sending it.`,
    example: `${REFRESH_COOKIE_NAME}=; Path=${REFRESH_COOKIE_PATH}; HttpOnly; SameSite=Lax; Max-Age=0`,
  }),
});

/**
 * Marks an endpoint as NOT requiring the document-level Bearer security scheme.
 * `register`, `login`, `refresh` and `logout` are reachable without an access token —
 * `refresh`/`logout` authenticate with the refresh cookie instead.
 */
const publicEndpoint = { security: [] };

// Register HTTP Route: POST /api/v1/auth/register
identityOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/register',
  summary: 'Register a new user account',
  description:
    'Creates a core user record, links email authentication, and establishes an initial session. ' +
    'The refresh token is returned as an HttpOnly cookie, never in the body.',
  tags: ['Identity & Authentication'],
  ...publicEndpoint,
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
      description: 'User successfully created and authenticated (refresh token set as a cookie)',
      headers: refreshCookieHeaderSchema,
      content: {
        'application/json': {
          schema: envelopeSchema.extend({
            data: z.object({
              user: authUserSchema,
              // NOTE: no `refreshToken` field — see `refreshCookieHeaderSchema`.
              tokens: z.object({ accessToken: accessTokenSchema }),
            }),
          }),
        },
      },
    },
    400: {
      description: 'Validation Error (Invalid request body)',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    409: {
      description: 'Conflict Error (Email already registered)',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});
// Register HTTP Route: POST /api/v1/auth/login
identityOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/login',
  summary: 'Authenticate with email and password',
  description:
    'Verifies credentials and starts a stateful session. The refresh token is returned as an ' +
    'HttpOnly cookie, never in the body.',
  tags: ['Identity & Authentication'],
  ...publicEndpoint,
  request: {
    body: {
      content: {
        'application/json': {
          schema: loginSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Authenticated successfully (refresh token set as a cookie)',
      headers: refreshCookieHeaderSchema,
      content: {
        'application/json': {
          schema: envelopeSchema.extend({
            data: z.object({
              user: authUserSchema,
              tokens: z.object({ accessToken: accessTokenSchema }),
            }),
          }),
        },
      },
    },
    400: {
      description: 'Validation Error (Malformed request body)',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized (Invalid email or password)',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

// Register HTTP Route: POST /api/v1/auth/refresh
identityOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/refresh',
  summary: 'Rotate the refresh token and issue a new access token',
  description: [
    'Performs an atomic compare-and-swap rotation: the presented token is replaced by a brand',
    'new one, and the old one is remembered so that replaying it can be detected as theft',
    '(which revokes every session for that user).',
    '',
    'The token is read from the HttpOnly cookie. A JSON body with `refreshToken` is accepted as',
    'a fallback for non-browser clients only, and is ignored when the cookie is present.',
  ].join('\n'),
  tags: ['Identity & Authentication'],
  ...publicEndpoint,
  request: {
    body: {
      required: false,
      content: {
        'application/json': {
          schema: refreshTokenSchema,
          description: 'Optional fallback for native clients.',
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Token rotated (new refresh token set as a cookie)',
      headers: refreshCookieHeaderSchema,
      content: {
        'application/json': {
          schema: envelopeSchema.extend({
            data: z.object({
              tokens: z.object({ accessToken: accessTokenSchema }),
            }),
          }),
        },
      },
    },
    401: {
      description:
        'Unauthorized (missing, expired, revoked, already rotated, or reused token — reuse revokes all sessions)',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

// Register HTTP Route: POST /api/v1/auth/logout
identityOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/logout',
  summary: 'End the current session and clear the refresh cookie',
  description: [
    'Revokes the session identified by the CURRENT refresh token.',
    'An already-rotated token cannot end a live session (that would let a stale cookie log the',
    'real user out), and the endpoint is idempotent: it always answers 200 and always clears the',
    'cookie, so a client can reach a signed-out state without retry logic.',
  ].join('\n'),
  tags: ['Identity & Authentication'],
  ...publicEndpoint,
  request: {
    body: {
      required: false,
      content: {
        'application/json': {
          schema: refreshTokenSchema,
          description: 'Optional fallback for native clients; ignored when the cookie is present.',
        },
      },
    },
  },
  responses: {
    200: {
      description:
        'Logged out (refresh cookie cleared); always returned, even if nothing was revoked',
      headers: refreshCookieClearedHeaderSchema,
      content: {
        'application/json': {
          schema: envelopeSchema.extend({
            data: z.null(),
          }),
        },
      },
    },
  },
});

// Register HTTP Route: GET /api/v1/auth/me
identityOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/auth/me',
  summary: 'Read the authenticated user from the access token',
  description:
    'Returns the claims embedded in the verified JWT. This endpoint never touches the refresh cookie.',
  tags: ['Identity & Authentication'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Authenticated user claims',
      content: {
        'application/json': {
          schema: envelopeSchema.extend({
            data: z.object({
              user: z
                .object({
                  userId: z.uuid(),
                  email: z.email(),
                })
                .openapi({ description: 'Decoded access-token payload.' }),
            }),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized (Missing or expired Bearer token)',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

// Export the shared schemas for reuse across module registries.
export { envelopeSchema, errorDetailsSchema, errorResponseSchema, errorSchema };
