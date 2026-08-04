import { drizzle } from 'drizzle-orm/node-postgres';
import { pool } from './client.js';
import * as schema from './schema/index.js';

// 1. Wrap the pool in Drizzle ORM
export const db = drizzle(pool, { schema });

// 3. Export the client utilities for graceful shutdown
export { closePool, pool } from './client.js';
// 2. Export the schema so modules can infer types
export * from './schema/index.js';
