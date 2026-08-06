/**
 * @fileoverview Configuration module
 *
 * This is the heart of the package.
 *
 * @responsibilities
 * - Read raw environment variables
 * - Validate them
 * - Transform them into useful types
 * - Freeze the resulting object
 * - Export it
 *
 * @example
 * config.server.port returns a number, not a string.
 */

import { z } from 'zod';

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),

  APP_NAME: z.string().min(1).default('Salon-Project'),

  HOST: z.string().default('0.0.0.0'),

  PORT: z.coerce.number().int().min(1).max(65535).default(3000), // <-- default port is 3000 while validation

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long.'),

  DATABASE_URL: z.url({
    protocol: /^postgres(?:ql)?$/,
  }),
});

export type Environment = z.infer<typeof environmentSchema>;
