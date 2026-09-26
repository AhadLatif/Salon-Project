import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * MIGRATION-CHAIN INTEGRITY GUARD
 *
 * This is a *rule enforced by the system*, not a convention we hope people follow.
 * It exists because two defects were found in the migration artifacts on 2026-09-25
 * (see `docs/90-shared/10-decisions-history/bug-reports/2026-09-26_database_migration_integrity_audit.md`):
 *
 *   1. `0012_add_refund_gateway_idempotency.sql` existed on disk but had NO `_journal.json`
 *      entry. drizzle-kit applies migrations by reading the journal, so that migration would
 *      never have been applied to ANY database — dev, test or a fresh production install.
 *   2. `0009_snapshot.json` was missing (historical BUG-07). Without it, `drizzle-kit generate`
 *      fell back to an older snapshot and re-emitted DDL that already existed.
 *
 * Both defects are silent: nothing crashes, the test suite stays green, and databases quietly
 * diverge. These assertions are pure-filesystem (no database, no Docker needed) so they run in
 * `pnpm test` with zero dependency on the environment.
 *
 * Read order for this file: journal <-> files parity -> ordering -> snapshots.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, '..', 'migrations');
const META_DIR = join(MIGRATIONS_DIR, 'meta');

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

const journal = JSON.parse(readFileSync(join(META_DIR, '_journal.json'), 'utf8')) as {
  entries: JournalEntry[];
};
const entries: JournalEntry[] = journal.entries ?? [];

const sqlTags = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => f.replace(/\.sql$/, ''))
  .sort();

const journalTags = entries.map((e) => e.tag);
const snapshotTags = readdirSync(META_DIR)
  .filter((f) => f.endsWith('_snapshot.json'))
  .map((f) => f.replace(/_snapshot\.json$/, ''));

/** drizzle names snapshots by zero-padded INDEX (`0012_snapshot.json`), while the journal
 *  uses the full tag (`0012_add_refund_gateway_idempotency`). Journal idx <-> snapshot name. */
const snapshotId = (idx: number): string => String(idx).padStart(4, '0');

/**
 * Known historical gaps we accept — explicitly, by name, so they stay visible.
 * A missing snapshot is only tolerated while it is NOT the newest one (a newer snapshot
 * means `drizzle-kit generate` diffs from a correct baseline). Any gap not listed here fails.
 */
const ACCEPTED_LEGACY_SNAPSHOT_GAPS = ['0009_add_payment'];

describe('migration chain integrity', () => {
  it('has at least one migration', () => {
    expect(entries.length).toBeGreaterThan(0);
    expect(sqlTags.length).toBeGreaterThan(0);
  });

  it('every .sql file on disk is registered in _journal.json (no orphaned migrations)', () => {
    const orphans = sqlTags.filter((tag) => !journalTags.includes(tag));
    expect(
      orphans,
      `ORPHANED MIGRATION(S): ${orphans.join(', ')} exist in migrations/ but are missing from _journal.json. ` +
        'drizzle-kit ONLY applies what the journal lists, so these will never run on any database — ' +
        'development, test or production will silently diverge. Fix: add the entry to _journal.json.',
    ).toEqual([]);
  });

  it('every _journal.json entry has a .sql file on disk', () => {
    const dangling = journalTags.filter((tag) => !sqlTags.includes(tag));
    expect(
      dangling,
      `DANGLING JOURNAL ENTRIES: ${dangling.join(', ')} are listed in _journal.json but have no .sql file. ` +
        'On a fresh database drizzle will try to run a file that does not exist and every migration will fail.',
    ).toEqual([]);
  });

  it('journal idx values are contiguous from 0 (drizzle applies by journal order)', () => {
    expect(entries.map((e) => e.idx)).toEqual(entries.map((_, i) => i));
  });

  it('journal "when" values are strictly increasing and unique', () => {
    const whens = entries.map((e) => e.when);
    const ascending = [...whens].sort((a, b) => a - b);
    expect(
      whens,
      'drizzle decides what still needs applying by comparing created_at against the highest value ' +
        'already in drizzle.__drizzle_migrations. Out-of-order or duplicate timestamps cause a migration ' +
        'to be skipped (schema gap) or re-run (errors on existing objects).',
    ).toEqual(ascending);
    expect(new Set(whens).size, 'duplicate `when` values in _journal.json').toBe(whens.length);
  });

  it('the NEWEST migration has a snapshot (protects future drizzle-kit generate)', () => {
    const newest = entries[entries.length - 1];
    if (!newest) throw new Error('No migration entries found in journal');
    expect(
      snapshotTags,
      `The latest migration "${newest.tag}" has no ${snapshotId(newest.idx)}_snapshot.json. Without it, the next ` +
        '`drizzle-kit generate` diffs from an OLDER snapshot and will re-emit DDL that already exists — ' +
        'the root cause of historical BUG-07.',
    ).toContain(snapshotId(newest.idx));
  });

  it('snapshot gaps are limited to the accepted legacy list (no new gaps)', () => {
    const gaps = entries
      .filter((e) => !snapshotTags.includes(snapshotId(e.idx)))
      .map((e) => e.tag)
      .sort();
    expect(
      gaps,
      'Snapshot files must exist for every migration. If you added one, drizzle-kit generated it — ' +
        'commit the *_snapshot.json alongside the .sql file. See bug-reports/2026-09-26_database_migration_integrity_audit.md',
    ).toEqual([...ACCEPTED_LEGACY_SNAPSHOT_GAPS]);
  });

  it('journal entry count equals .sql file count', () => {
    expect(
      entries.length,
      'The migration artifact set is inconsistent: _journal.json and migrations/ disagree on size.',
    ).toBe(sqlTags.length);
  });
});
