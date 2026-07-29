import { config } from '@salon/config';
import { Pool } from 'pg';

/**
 * Shared PostgreSQL connection pool.
 *
 * This pool centralizes database connections for the entire application.
 * Individual modules should not create their own pools.
 */

export const pool = new Pool({
  connectionString: config.database.url,

  // Prevent indefinite hangs while acquiring or establishing connections
  // `connectionTimeoutMillis` - how long to wait when connecting a new client
  // `idleTimeoutMillis` - how long a client must sit idle in the pool before being closed

  connectionTimeoutMillis: 10000, // 10s
  idleTimeoutMillis: 30000, // 30s
  // sensible default for app workloads; tweak via config if necessary
  max: 10,
});

// Log unexpected errors from idle clients to avoid unhandled-exception crashes.
// Applications may choose to escalate (for example, trigger shutdown) in
// the top-level graceful-shutdown path.

pool.on('error', (err) => {
  // Use console here to avoid depending on a logger at module-initialization time.
  console.error('Unexpected error on idle PostgreSQL client', err);
});

/**
 * Close the shared pool. Call this from the application's graceful-shutdown
 * path (for example, SIGINT/SIGTERM handlers) to ensure pooled
 * connections are released cleanly.
 */
export async function closePool(): Promise<void> {
  try {
    await pool.end();
    console.info('PostgreSQL pool closed');
  } catch (err) {
    console.error('Error while closing PostgreSQL pool', err);
  }
}
