CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
-- ADR-009 composite-tenant unique on the parent, so child tables can reference
-- (business_id, id). id is the PK, so this is already unique by construction;
-- the constraint exists to give the composite FK a matching unique key.
ALTER TABLE "appointment_services" ADD CONSTRAINT "uq_appt_services_tenant_id" UNIQUE("business_id","id");--> statement-breakpoint
CREATE TABLE "appointment_service_allocations" (
"id" uuid PRIMARY KEY NOT NULL,
"business_id" uuid NOT NULL,
"appointment_id" uuid NOT NULL,
"appointment_service_id" uuid NOT NULL,
"staff_member_id" uuid NOT NULL,
"occupied_period" "tstzrange" NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- THE reservation invariant: same tenant + staff member can never hold two
-- overlapping occupied intervals. Half-open [start, end) means adjacent bookings
-- ([10:00,10:30) and [10:30,11:00)) do NOT conflict. Drizzle cannot express
-- EXCLUDE USING gist, so this constraint is maintained by hand and is intentionally
-- NOT part of the drizzle-kit snapshot (documented limitation).
ALTER TABLE "appointment_service_allocations" ADD CONSTRAINT "no_staff_time_overlap" EXCLUDE USING gist ("business_id" WITH =, "staff_member_id" WITH =, "occupied_period" WITH &&);--> statement-breakpoint
ALTER TABLE "appointment_service_allocations" ADD CONSTRAINT "fk_allocation_appointment_tenant" FOREIGN KEY ("business_id","appointment_id") REFERENCES "public"."appointments"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_service_allocations" ADD CONSTRAINT "fk_allocation_appointment_service_tenant" FOREIGN KEY ("business_id","appointment_service_id") REFERENCES "public"."appointment_services"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_service_allocations" ADD CONSTRAINT "fk_allocation_staff_tenant" FOREIGN KEY ("business_id","staff_member_id") REFERENCES "public"."staff_members"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_allocations_appointment" ON "appointment_service_allocations" USING btree ("business_id","appointment_id");--> statement-breakpoint
CREATE INDEX "idx_allocations_appointment_service" ON "appointment_service_allocations" USING btree ("business_id","appointment_service_id");--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "chk_appt_services_processing_time" CHECK ("appointment_services"."processing_time_minutes" >= 0);--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "chk_appt_services_extra_time" CHECK ("appointment_services"."extra_time_minutes" >= 0);--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "chk_appt_services_buffer_before" CHECK ("appointment_services"."buffer_before_minutes" >= 0);--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "chk_appt_services_buffer_after" CHECK ("appointment_services"."buffer_after_minutes" >= 0);--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "chk_appt_services_sequence" CHECK ("appointment_services"."sequence" >= 1);
