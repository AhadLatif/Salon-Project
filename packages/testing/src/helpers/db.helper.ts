import { type Database, db as defaultDb } from '@salon/database';
import { sql } from 'drizzle-orm';

/**
 * Truncates all tables in the test database to ensure test isolation.
 */
export async function truncateAllTables(dbClient: Database = defaultDb): Promise<void> {
  const tables = [
    'business_role_permissions',
    'business_roles',
    'permissions',
    'business_members',
    'branches',
    'business_settings',
    'opening_hours',
    'businesses',
    'user_sessions',
    'user_auth_providers',
    'user_roles',
    'role_permissions',
    'roles',
    'users',
  ];

  for (const table of tables) {
    try {
      await dbClient.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE;`));
    } catch (err: unknown) {
      const errorObj = err as {
        code?: string;
        message?: string;
        cause?: { code?: string; message?: string };
      };
      const code = errorObj?.cause?.code || errorObj?.code;
      const message = errorObj?.cause?.message || errorObj?.message || String(err);

      const isMissingTableErr =
        code === '42P01' || (typeof message === 'string' && message.includes('does not exist'));

      if (!isMissingTableErr) {
        throw err;
      }
    }
  }
}
