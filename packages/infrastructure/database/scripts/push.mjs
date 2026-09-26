#!/usr/bin/env node
/**
 * GUARD: `db:push` must not be used on shared databases.
 *
 * Root cause of the 2026-09-25 divergence: `drizzle-kit push` synchronises the LIVE
 * database straight from the TypeScript schema and does NOT write to `drizzle.__drizzle_migrations`.
 * The schema advanced, the journal did not — so the next `drizzle-kit migrate` had no idea what
 * had actually been applied, and every environment drifted apart.
 *
 * The correct flow is ALWAYS: `pnpm db:generate <name>` -> `pnpm db:migrate`.
 *
 * Escape hatch: ALLOW_DB_PUSH=1 (for deliberate local experiments only — afterwards run
 * `pnpm db:verify` because push left the journal behind).
 */
if (process.env.ALLOW_DB_PUSH !== '1') {
  console.error(
    [
      '',
      '❌  db:push is BLOCKED on this project.',
      '',
      '  drizzle-kit push applies your TypeScript schema directly to the live database and does NOT',
      '  record anything in the migration journal (drizzle.__drizzle_migrations). That is exactly how',
      '  dev/test databases drifted apart on 2026-09-25 (see bug-reports/2026-09-26_database_migration_integrity_audit.md).',
      '',
      '  ✔ Use instead:',
      '       pnpm db:generate <lower_snake_case_name>',
      '       pnpm db:migrate',
      '',
      '  If you really must push to a throw-away local database:',
      '       ALLOW_DB_PUSH=1 pnpm db:push      then immediately run:  pnpm db:verify',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

console.warn('⚠️  ALLOW_DB_PUSH=1 — proceeding with drizzle-kit push.');
console.warn(
  '⚠️  Remember: this does NOT update the migration journal. Run `pnpm db:verify` after.',
);

const { execFileSync } = await import('node:child_process');
execFileSync('npx', ['drizzle-kit', 'push'], { stdio: 'inherit' });
