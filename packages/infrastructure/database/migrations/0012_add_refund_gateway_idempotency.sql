DROP INDEX "uq_refunds_gateway";--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "gateway" text;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_refunds_gateway" ON "refunds" USING btree (COALESCE("gateway", '__drizzle_null__'),"gateway_refund_id") WHERE "refunds"."gateway_refund_id" IS NOT NULL;