import { randomUUID } from 'node:crypto';
import { branches, db } from '@salon/database';
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * PostGIS geo foundation proof (ADR-017, POSTGIS_SETUP_PLAN.md S6).
 *
 * Runs against real PostgreSQL (salon_test) — a mock cannot prove that the extension,
 * the column typmod, the backfill statement or the distance maths actually work.
 * Same self-managed seeding style as allocations-overlap.test.ts (no @salon/testing here:
 * that package depends on @salon/database, so importing it back would be circular).
 */
async function exec(statement: string) {
  await db.execute(sql.raw(statement));
}

/** The exact backfill statement from migration 0014 — re-runnable by design. */
const BACKFILL = `
  UPDATE "branches"
     SET "location" = ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography
   WHERE "latitude" BETWEEN -90 AND 90
     AND "longitude" BETWEEN -180 AND 180
     AND "location" IS NULL`;

describe('PostGIS geo foundation (ADR-017)', () => {
  let businessId: string;

  beforeEach(async () => {
    await exec('TRUNCATE TABLE branches CASCADE');
    await exec('TRUNCATE TABLE businesses CASCADE');
    businessId = randomUUID();
    await exec(
      `INSERT INTO businesses (id, slug, name, email, phone_number, status)
       VALUES ('${businessId}', 'geo-${businessId.slice(0, 8)}', 'Geo Biz', 'geo@a.com', '+1234567890', 'active')`,
    );
  });

  async function seedBranch(latitude: string | null, longitude: string | null): Promise<string> {
    const id = randomUUID();
    await exec(
      `INSERT INTO branches (id, business_id, name, timezone, currency, address_line_1, city, country_code, latitude, longitude)
       VALUES ('${id}', '${businessId}', 'Geo Branch', 'UTC', 'US', '1 Main St', 'New York', 'US',
               ${latitude === null ? 'NULL' : `'${latitude}'`}, ${longitude === null ? 'NULL' : `'${longitude}'`})`,
    );
    return id;
  }

  async function locationText(id: string): Promise<string | null> {
    const rows = await db
      .select({ wkt: sql<string | null>`ST_AsText(location)` })
      .from(branches)
      .where(eq(branches.id, id));
    return rows[0]?.wkt ?? null;
  }

  it('has the postgis extension installed (3.6.x)', async () => {
    const result = await db.execute(sql`SELECT postgis_full_version() AS v`);
    const row = result.rows[0] as { v: string };
    expect(row.v).toContain('POSTGIS=');
    // Real format: POSTGIS="3.6.4 0" [EXTENSION] PGSQL="180" … (quoted version).
    expect(row.v).toMatch(/POSTGIS="3\.6/);
  });

  it('stores branches.location as geography(Point,4326)', async () => {
    const result = await db.execute(sql`
      SELECT postgis_typmod_type(atttypmod) AS t, postgis_typmod_srid(atttypmod) AS s
      FROM pg_attribute
      WHERE attrelid = 'branches'::regclass AND attname = 'location'`);
    const row = result.rows[0] as { t: string; s: number };
    expect(row.t).toBe('Point');
    expect(row.s).toBe(4326);
  });

  it('backfills location from latitude/longitude with longitude FIRST (x = lon)', async () => {
    const id = await seedBranch('40.7128', '-74.0060');
    expect(await locationText(id)).toBeNull(); // not populated until backfill runs

    await exec(BACKFILL);

    // POINT(x y) = POINT(longitude latitude) — getting this backwards fails silently,
    // so the assertion pins the exact order.
    expect(await locationText(id)).toBe('POINT(-74.006 40.7128)');
  });

  it('leaves location NULL for branches without a complete coordinate pair', async () => {
    const noCoords = await seedBranch(null, null);
    const halfCoords = await seedBranch('40.7128', null); // latitude alone is not a point

    await exec(BACKFILL);

    expect(await locationText(noCoords)).toBeNull();
    expect(await locationText(halfCoords)).toBeNull();
  });

  it('answers radius questions with ST_DWithin and exact metres with ST_Distance', async () => {
    const id = await seedBranch('40.0000', '-74.0000');
    await exec(BACKFILL);

    // Probe 0.01° of latitude north: ~1.1 km on the WGS84 spheroid.
    const probe = sql`ST_SetSRID(ST_MakePoint(-74.0000, 40.0100), 4326)::geography`;
    const rows = await db.execute(sql`
      SELECT
        ST_DWithin(location, ${probe}, 2000) AS within_2km,
        ST_DWithin(location, ${probe}, 100)   AS within_100m,
        ST_Distance(location, ${probe})       AS metres
      FROM branches WHERE id = ${id}`);
    const row = rows.rows[0] as { within_2km: boolean; within_100m: boolean; metres: number };

    expect(row.within_2km).toBe(true);
    expect(row.within_100m).toBe(false);
    // 0.01° latitude ≈ 1110 m (meridian arc at 40°N, WGS84) — tolerance guards the
    // spheroid model, a wrong hemisphere or a degrees-as-metres mistake would miss by far more.
    expect(row.metres).toBeGreaterThan(1100);
    expect(row.metres).toBeLessThan(1125);
  });
});
