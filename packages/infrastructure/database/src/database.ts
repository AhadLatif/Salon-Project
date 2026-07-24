import { drizzle } from "drizzle-orm/node-postgres";

import { pool } from "./client.js";

/**
 * Shared Drizzle ORM instance.
 *
 * Every module imports this object to execute database queries.
 * The underlying PostgreSQL connection is provided by the shared pool.
 */
export const database = drizzle({
  client: pool,
});