-- Payment module: cash MVP. Creates enums + payments, payment_transactions, refunds.
-- Tables were already defined in the Drizzle schema (schema/payment/) but no migration
-- had ever materialized them. This mirrors that schema exactly (tenant-scoped composite
-- FKs, idempotency uniques, amount integrity checks). Money columns are numeric(10,2).

CREATE TYPE "payment_status" AS ENUM ('unpaid','partially_paid','paid','partially_refunded','refunded');--> statement-breakpoint
CREATE TYPE "payment_method" AS ENUM ('cash','card','online','bank_transfer','gift_card');--> statement-breakpoint
CREATE TYPE "transaction_status" AS ENUM ('pending','authorized','captured','failed','cancelled');--> statement-breakpoint
CREATE TYPE "refund_status" AS ENUM ('pending','completed','failed');--> statement-breakpoint

-- payments: one aggregate record per appointment (uq_payments_appointment).
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"currency" char(3) DEFAULT 'PKR' NOT NULL,
	"subtotal_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"discount_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"tax_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"tip_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"total_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "idx_payments_business" ON "payments" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_payments_status" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payments_paid_at" ON "payments" USING btree ("paid_at");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_appointment_tenant" FOREIGN KEY ("business_id","appointment_id") REFERENCES "appointments"("business_id","id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "uq_payments_appointment" UNIQUE ("appointment_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "uq_payments_business_id" UNIQUE ("business_id","id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "chk_payments_subtotal" CHECK ("subtotal_amount" >= 0);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "chk_payments_discount" CHECK ("discount_amount" >= 0);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "chk_payments_tax" CHECK ("tax_amount" >= 0);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "chk_payments_tip" CHECK ("tip_amount" >= 0);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "chk_payments_total" CHECK ("total_amount" >= 0);--> statement-breakpoint
-- payment_transactions: individual money movements against a payment.
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"business_customer_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"gateway" text,
	"gateway_transaction_id" text,
	"gateway_reference" text,
	"processed_at" timestamp with time zone,
	"failure_reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "idx_pay_tx_business" ON "payment_transactions" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_pay_tx_payment" ON "payment_transactions" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_pay_tx_status" ON "payment_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pay_tx_method" ON "payment_transactions" USING btree ("method");--> statement-breakpoint
CREATE INDEX "idx_pay_tx_processed_at" ON "payment_transactions" USING btree ("processed_at");--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "fk_payment_appointment_tenant" FOREIGN KEY ("business_id","appointment_id") REFERENCES "appointments"("business_id","id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "fk_payment_customer_tenant" FOREIGN KEY ("business_id","business_customer_id") REFERENCES "business_customers"("business_id","id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "fk_payment_payment_tenant" FOREIGN KEY ("business_id","payment_id") REFERENCES "payments"("business_id","id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "uq_pay_tx_tenant_id" UNIQUE ("business_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pay_tx_gateway" ON "payment_transactions" USING btree (COALESCE("gateway", '__drizzle_null__'),"gateway_transaction_id") WHERE "gateway_transaction_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "chk_pay_tx_amount" CHECK ("amount" > 0);--> statement-breakpoint

-- refunds: money returned against a captured transaction.
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"payment_transaction_id" uuid NOT NULL,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"reason" text,
	"processed_by" uuid,
	"gateway_refund_id" text,
	"gateway_reference" text,
	"processed_at" timestamp with time zone,
	"failure_reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "idx_refunds_business" ON "refunds" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_refunds_transaction" ON "refunds" USING btree ("payment_transaction_id");--> statement-breakpoint
CREATE INDEX "idx_refunds_status" ON "refunds" USING btree ("status");--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "fk_refund_payment_tenant" FOREIGN KEY ("business_id","payment_transaction_id") REFERENCES "payment_transactions"("business_id","id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "fk_refund_processed_by_tenant" FOREIGN KEY ("business_id","processed_by") REFERENCES "business_members"("business_id","id") ON DELETE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_refunds_gateway" ON "refunds" USING btree ("gateway_refund_id") WHERE "gateway_refund_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "chk_refunds_amount" CHECK ("amount" > 0);--> statement-breakpoint