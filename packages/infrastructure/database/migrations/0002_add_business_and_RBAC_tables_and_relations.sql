CREATE TYPE "public"."branch_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."business_status" AS ENUM('pending', 'active', 'suspended', 'archived');--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone_number" text,
	"email" text,
	"timezone" text NOT NULL,
	"currency" char(3) NOT NULL,
	"address_line_1" text NOT NULL,
	"address_line_2" text,
	"city" text NOT NULL,
	"state" text,
	"postal_code" text,
	"country_code" char(2) NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"status" "branch_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"language" text DEFAULT 'en-US' NOT NULL,
	"cancellation_policy" text,
	"deposit_policy" text,
	"tax_settings" jsonb DEFAULT '{}'::jsonb,
	"require_deposit" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_settings_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"email" text NOT NULL,
	"phone_number" text NOT NULL,
	"status" "business_status" DEFAULT 'pending' NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "opening_hours" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"shift_name" text,
	"is_closed" boolean DEFAULT false NOT NULL,
	"opens_at" time,
	"closes_at" time,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_opening_hours_day_of_week" CHECK ("opening_hours"."day_of_week" BETWEEN 1 AND 7),
	CONSTRAINT "chk_opening_hours_time_order" CHECK ("opening_hours"."opens_at" < "opening_hours"."closes_at"),
	CONSTRAINT "chk_opening_hours_closed_day" CHECK ((
        ("opening_hours"."is_closed" = TRUE AND "opening_hours"."opens_at" IS NULL AND "opening_hours"."closes_at" IS NULL)
        OR
        ("opening_hours"."is_closed" = FALSE AND "opening_hours"."opens_at" IS NOT NULL AND "opening_hours"."closes_at" IS NOT NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE "business_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "business_roles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_business_roles_name" UNIQUE("business_id","name")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"module" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_role_id_business_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."business_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_role_permissions" ADD CONSTRAINT "business_role_permissions_role_id_business_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."business_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_role_permissions" ADD CONSTRAINT "business_role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_roles" ADD CONSTRAINT "business_roles_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_branches_business" ON "branches" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_branches_status" ON "branches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_branches_city" ON "branches" USING btree ("city");--> statement-breakpoint
CREATE INDEX "idx_businesses_status" ON "businesses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_opening_hours_business" ON "opening_hours" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_opening_hours_branch" ON "opening_hours" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_business_members_business" ON "business_members" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_business_members_user" ON "business_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_business_members_role" ON "business_members" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_business_user" ON "business_members" USING btree ("business_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_business_roles_business" ON "business_roles" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_business_roles_order" ON "business_roles" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "idx_permissions_module" ON "permissions" USING btree ("module");