-- 0007_enforce_customer_tenant_integrity
-- Reconciles existing data before enforcing tenant-isolation constraints:
--   1. Clean invalid cross-business customer_notes references (customer & author).
--   2. Deduplicate business_customers rows that share the same (business_id, user_id).
--   3. Enforce composite FKs on customer_notes and the partial unique index on
--      business_customers (business_id, user_id) WHERE user_id IS NOT NULL.

-- Step 1a: Null out author_id on notes whose author belongs to a DIFFERENT business.
-- The composite FK (business_id, author_id) would otherwise reject these rows.
UPDATE "customer_notes"
SET "author_id" = NULL
WHERE "author_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "business_members"
    WHERE "business_members"."id" = "customer_notes"."author_id"
      AND "business_members"."business_id" = "customer_notes"."business_id"
  );
--> statement-breakpoint

-- Step 1b: Delete notes whose customer belongs to a DIFFERENT business.
-- These are orphaned cross-tenant rows that cannot be safely re-parented.
DELETE FROM "customer_notes"
WHERE NOT EXISTS (
  SELECT 1 FROM "business_customers"
  WHERE "business_customers"."id" = "customer_notes"."business_customer_id"
    AND "business_customers"."business_id" = "customer_notes"."business_id"
);
--> statement-breakpoint

-- Step 2: Deduplicate business_customers sharing the same (business_id, user_id).
-- Keep the OLDEST row (lowest created_at, then lowest id) and null out user_id on
-- the duplicates so they remain as unrestricted walk-in/guest profiles. This avoids
-- deleting CRM history (notes, tags, favorites) that may reference the duplicate.
UPDATE "business_customers" AS dup
SET "user_id" = NULL
WHERE "dup"."user_id" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "business_customers" AS keep
    WHERE "keep"."business_id" = "dup"."business_id"
      AND "keep"."user_id" = "dup"."user_id"
      AND (
        "keep"."created_at" < "dup"."created_at"
        OR ("keep"."created_at" = "dup"."created_at" AND "keep"."id" < "dup"."id")
      )
  );
--> statement-breakpoint

ALTER TABLE "customer_notes" DROP CONSTRAINT "customer_notes_business_customer_id_business_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "customer_notes" DROP CONSTRAINT "customer_notes_author_id_business_members_id_fk";
--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_business_customer_id_business_customers_id_fk" FOREIGN KEY ("business_id","business_customer_id") REFERENCES "public"."business_customers"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_author_id_business_members_id_fk" FOREIGN KEY ("business_id","author_id") REFERENCES "public"."business_members"("business_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_bus_customers_user" ON "business_customers" USING btree ("business_id","user_id") WHERE "business_customers"."user_id" IS NOT NULL;