-- PostGIS foundation (ADR-017, plan: docs/20-backend/30-implementation/10-workflows/marketplace/POSTGIS_SETUP_PLAN.md)
--
-- Hand-edited parts (precedent: migrations 0006, 0008 — ADR-017 §5.4):
--   1. CREATE EXTENSION — must run FIRST; the column type below does not exist without it.
--   2. The ADD COLUMN type is UNQUOTED: drizzle-kit emits "geography(Point,4326)" as a single
--      quoted identifier, which PostgreSQL rejects with `type "geography(Point,4326)" does not exist`
--      (verified 2026-10-09). Snapshot meta stores the type unquoted and is untouched.
--   3. Backfill — builds the spatial copy for rows that predate this migration.
-- Longitude is the x axis: ST_MakePoint(longitude, latitude) — order matters, errors here are silent.
CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "location" geography(Point,4326);--> statement-breakpoint
UPDATE "branches"
   SET "location" = ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography
 WHERE "latitude" BETWEEN -90 AND 90
   AND "longitude" BETWEEN -180 AND 180
   AND "location" IS NULL;
