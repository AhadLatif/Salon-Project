#!/usr/bin/env node
/**
 * db:verify — schema drift detector (non-destructive).
 *
 * Proves that the database you point at is structurally identical to what the migration chain
 * produces from zero. It never touches the target: it replays the chain into a throwaway
 * scratch database, compares schema objects over SQL, then drops the scratch.
 *
 * Usage:  pnpm db:verify                       (verifies DATABASE_URL / .env)
 *         pnpm db:verify --db=postgres://...   (explicit target)
 *
 * Exits 1 on any difference, printing a unified diff. Read-only with respect to the target.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';

loadEnv({ path: resolve(process.cwd(), '../../../.env') });

const explicit = process.argv.find((a) => a.startsWith('--db='))?.slice('--db='.length);
const targetUrl = explicit || process.env.DATABASE_URL;
if (!targetUrl) {
  console.error('❌ DATABASE_URL is not set and --db= was not provided.');
  process.exit(1);
}
const scratchUrl = new URL(targetUrl);
const SCRATCH_DB = `salon_verify_${Date.now()}`;
scratchUrl.pathname = `/${SCRATCH_DB}`;

/**
 * One canonical description of a schema. Comparing these lists catches the things that matter:
 * tables, columns (type/nullable/default), constraints, indexes and enum types — including the
 * subtle case where a UNIQUE constraint exists as a bare CREATE UNIQUE INDEX instead.
 */
const SCHEMA_QUERY = `
  SELECT 'TABLE|' || table_name FROM information_schema.tables WHERE table_schema='public'
  UNION ALL
  SELECT 'COLUMN|' || table_name || '.' || column_name || '|' || data_type || '|' || is_nullable || '|' || coalesce(column_default, '')
    FROM information_schema.columns WHERE table_schema='public'
  UNION ALL
  SELECT 'CONSTRAINT|' || conname || '|' || pg_get_constraintdef(c.oid)
    FROM pg_constraint c WHERE c.connamespace = 'public'::regnamespace
  UNION ALL
  SELECT 'INDEX|' || indexname || '|' || indexdef FROM pg_indexes WHERE schemaname='public'
  UNION ALL
  SELECT 'TYPE|' || typname FROM pg_type
    WHERE typtype='e' AND typnamespace='public'::regnamespace
  ORDER BY 1`;

async function describeSchema(url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query(SCHEMA_QUERY);
    return rows.map((r) => Object.values(r)[0]);
  } finally {
    await client.end();
  }
}

const adminUrl = new URL(targetUrl.toString());
adminUrl.pathname = '/postgres';

let failed = false;
try {
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${SCRATCH_DB}"`);
  await admin.end();

  console.log(`▶ replaying migration chain into "${SCRATCH_DB}" ...`);
  execFileSync('pnpm', ['run', 'db:migrate'], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, DATABASE_URL: scratchUrl.toString() },
  });

  const [target, scratch] = await Promise.all([
    describeSchema(targetUrl.toString()),
    describeSchema(scratchUrl.toString()),
  ]);

  const missing = target.filter((l) => !scratch.includes(l));
  const extra = scratch.filter((l) => !target.includes(l));

  if (missing.length === 0 && extra.length === 0) {
    console.log(
      `✅ NO DRIFT — target matches the migration chain (${target.length} schema objects).`,
    );
  } else {
    failed = true;
    console.error(`\n❌ DRIFT DETECTED — target differs from the migration chain.`);
    for (const l of missing) {
      console.error(`  IN TARGET ONLY: ${l}`);
    }
    for (const l of extra) {
      console.error(`  IN CHAIN ONLY  : ${l}`);
    }
    console.error(
      '\n  Fix: the target was changed outside of migrations (e.g. drizzle-kit push), or a migration\n' +
        '  never ran. Repair with `pnpm db:migrate`, then re-run `pnpm db:verify`.\n',
    );
  }
} finally {
  // Always drop the scratch database, even on failure.
  try {
    const admin = new pg.Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS "${SCRATCH_DB}"`);
    await admin.end();
    console.log(`✔ scratch "${SCRATCH_DB}" dropped — target untouched.`);
  } catch (e) {
    console.error(`⚠ could not drop scratch database ${SCRATCH_DB}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
