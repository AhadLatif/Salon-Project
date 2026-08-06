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

// import "dotenv"
import { prettifyError } from 'zod';

import { environmentSchema } from './schema.js';

// first parse compelete env file via zod
const parsed = environmentSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration.');
  console.error(prettifyError(parsed.error));

  process.exitCode = 1;
  throw new Error('Application startup aborted.');
}

// lock the configuration object by freeze() so it cannot be modified at runtime,
// though it would not freeze nested objects, but we are not using nested objects here

export const config = Object.freeze({
  // ** Instead of exposing flat properties, expose logical groups.
  server: Object.freeze({
    host: parsed.data.HOST,
    port: parsed.data.PORT,
  }),

  app: Object.freeze({
    name: parsed.data.APP_NAME,
    environment: parsed.data.NODE_ENV,
  }),
  secret: Object.freeze({
    jwt: parsed.data.JWT_SECRET,
  }),

  logging: Object.freeze({
    level: parsed.data.LOG_LEVEL,
  }),
  database: Object.freeze({
    url: parsed.data.DATABASE_URL,
  }),
});
