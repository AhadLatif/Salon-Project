import { type Database, db as defaultDb } from '@salon/database';
import { sql } from 'drizzle-orm';

/**
 * Truncates all tables in the test database to ensure test isolation.
 */
export async function truncateAllTables(dbClient: Database = defaultDb): Promise<void> {
  const tables = [
    'customer_tag_assignments',
    'customer_notes',
    'customer_tags',
    'customer_favorites',
    'business_customers',
    'staff_schedule_shifts',
    'staff_work_schedules',
    'staff_service_assignments',
    'staff_branch_assignments',
    'staff_members',
    'branch_services',
    'services',
    'service_categories',
    'business_role_permissions',
    'business_roles',
    'permissions',
    'business_members',
    'opening_hours',
    'branches',
    'business_settings',
    'businesses',
    'user_sessions',
    'appointment_notes',
    'appointment_service_allocations',
    'appointment_services',
    'appointment_status_history',
    'appointments',
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
