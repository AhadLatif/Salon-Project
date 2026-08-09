ALTER TABLE "opening_hours" DROP CONSTRAINT "opening_hours_branch_id_branches_id_fk";
--> statement-breakpoint
ALTER TABLE "business_members" DROP CONSTRAINT "business_members_role_id_business_roles_id_fk";
--> statement-breakpoint
ALTER TABLE "business_roles" ADD CONSTRAINT "uq_bus_roles_tenant_id" UNIQUE("business_id","id");--> statement-breakpoint
ALTER TABLE "opening_hours" ADD CONSTRAINT "fk_opening_hours_branch_tenant" FOREIGN KEY ("business_id","branch_id") REFERENCES "public"."branches"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_members" ADD CONSTRAINT "fk_business_member_role_tenant" FOREIGN KEY ("business_id","role_id") REFERENCES "public"."business_roles"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "chk_branches_name" CHECK (length(trim("branches"."name")) > 0);--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "chk_businesses_slug" CHECK ("businesses"."slug" ~ '^[a-z0-9-]+$');--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "chk_businesses_name" CHECK (length(trim("businesses"."name")) > 0);--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "chk_businesses_phone_e164" CHECK ("businesses"."phone_number" ~ '^\+[1-9][0-9]{1,14}$');--> statement-breakpoint
ALTER TABLE "business_roles" ADD CONSTRAINT "chk_business_roles_name" CHECK (length(trim("business_roles"."name")) > 0);--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "chk_permissions_code" CHECK (length(trim("permissions"."code")) > 0);--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "chk_permissions_name" CHECK (length(trim("permissions"."name")) > 0);