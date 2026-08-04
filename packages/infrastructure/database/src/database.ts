// packages/infrastructure/database/src/index.ts

import { drizzle } from 'drizzle-orm/node-postgres';
import { pool } from './client.js';

// Import all your schemas (make sure you have an index.js exporting them all)
import * as schema from './schema/index.js';

// 2. Export the schemas so your generic repositories can use the types later
export * from './schema/index.js';

// 1. Wrap the pool in Drizzle ORM
export const db = drizzle(pool, { schema });

// 3. Export the pool utilities for graceful shutdown in the API
export { closePool, pool } from './client.js';
