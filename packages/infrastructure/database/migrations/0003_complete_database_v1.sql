CREATE TYPE "public"."appointment_status" AS ENUM('pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."booking_channel" AS ENUM('marketplace', 'business_dashboard', 'walk_in');--> statement-breakpoint
CREATE TYPE "public"."audit_actor_type" AS ENUM('USER', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."customer_gender" AS ENUM('male', 'female', 'other', 'prefer_not_to_say');--> statement-breakpoint
CREATE TYPE "public"."customer_status" AS ENUM('active', 'blocked', 'archived');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('uploading', 'available', 'processing', 'failed', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."service_media_purpose" AS ENUM('cover_image', 'gallery_image');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('PENDING', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('EMAIL', 'SMS', 'PUSH', 'IN_APP');--> statement-breakpoint
CREATE TYPE "public"."notification_priority" AS ENUM('LOW', 'NORMAL', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."responder_type" AS ENUM('business', 'team_member');--> statement-breakpoint
CREATE TYPE "public"."response_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'contractor');--> statement-breakpoint
CREATE TYPE "public"."staff_status" AS ENUM('active', 'inactive', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."time_off_reason" AS ENUM('vacation', 'sick_leave', 'personal_leave', 'training', 'unavailable', 'other');--> statement-breakpoint
CREATE TYPE "public"."schedule_recurrence" AS ENUM('weekly', 'biweekly', 'triweekly', 'four_weekly');--> statement-breakpoint
CREATE TABLE "appointment_notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"author_id" uuid,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_services" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"staff_member_id" uuid NOT NULL,
	"service_name" text NOT NULL,
	"staff_name" text NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"duration_minutes" smallint NOT NULL,
	"processing_time_minutes" smallint DEFAULT 0 NOT NULL,
	"extra_time_minutes" smallint DEFAULT 0 NOT NULL,
	"buffer_before_minutes" smallint DEFAULT 0 NOT NULL,
	"buffer_after_minutes" smallint DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"sequence" smallint NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_appt_services_price" CHECK ("appointment_services"."unit_price" >= 0),
	CONSTRAINT "chk_appt_services_duration" CHECK ("appointment_services"."duration_minutes" > 0),
	CONSTRAINT "chk_appt_services_schedule" CHECK ("appointment_services"."ends_at" > "appointment_services"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "appointment_status_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"from_status" "appointment_status",
	"to_status" "appointment_status" NOT NULL,
	"changed_by_business_member_id" uuid,
	"changed_by_user_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"business_customer_id" uuid NOT NULL,
	"status" "appointment_status" DEFAULT 'pending' NOT NULL,
	"booking_channel" "booking_channel" NOT NULL,
	"scheduled_start_at" timestamp with time zone NOT NULL,
	"scheduled_end_at" timestamp with time zone NOT NULL,
	"created_by_user_id" uuid,
	"created_by_business_member_id" uuid,
	"cancellation_reason" text,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_user_id" uuid,
	"cancelled_by_business_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_appointments_tenant_id" UNIQUE("business_id","id"),
	CONSTRAINT "chk_appointments_schedule" CHECK ("appointments"."scheduled_end_at" > "appointments"."scheduled_start_at"),
	CONSTRAINT "chk_appointments_cancelled" CHECK (("appointments"."status" <> 'cancelled') OR ("appointments"."cancelled_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid,
	"actor_type" "audit_actor_type" NOT NULL,
	"actor_user_id" uuid,
	"actor_user_name" varchar(255),
	"actor_user_email" varchar(320),
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" uuid NOT NULL,
	"changes" jsonb,
	"metadata" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_audit_actor_consistency" CHECK (
        ("audit_logs"."actor_type" = 'SYSTEM' AND "audit_logs"."actor_user_id" IS NULL)
        OR
        (
          "audit_logs"."actor_type" = 'USER' AND (
            "audit_logs"."actor_user_id" IS NOT NULL
            OR "audit_logs"."actor_user_name" IS NOT NULL
            OR "audit_logs"."actor_user_email" IS NOT NULL
          )
        )
      )
);
--> statement-breakpoint
CREATE TABLE "business_customers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid,
	"first_name" text NOT NULL,
	"last_name" text,
	"phone_number" text,
	"email" text,
	"gender" "customer_gender" DEFAULT 'prefer_not_to_say',
	"date_of_birth" date,
	"status" "customer_status" DEFAULT 'active' NOT NULL,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_bus_customers_tenant_id" UNIQUE("business_id","id"),
	CONSTRAINT "chk_bus_customers_contact" CHECK ("business_customers"."email" IS NOT NULL OR "business_customers"."phone_number" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "customer_favorites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"business_id" uuid,
	"staff_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_favorites_target" CHECK ("customer_favorites"."business_id" IS NOT NULL OR "customer_favorites"."staff_member_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "customer_notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"business_customer_id" uuid NOT NULL,
	"author_id" uuid,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_tag_assignments" (
	"business_id" uuid NOT NULL,
	"business_customer_id" uuid NOT NULL,
	"customer_tag_id" uuid NOT NULL,
	"assigned_by" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_tag_assignments_business_customer_id_customer_tag_id_pk" PRIMARY KEY("business_customer_id","customer_tag_id")
);
--> statement-breakpoint
CREATE TABLE "customer_tags" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_customer_tags_tenant" UNIQUE("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "media_files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid,
	"uploaded_by_user_id" uuid,
	"original_filename" varchar(255) NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size_bytes" bigint NOT NULL,
	"checksum_sha256" char(64) NOT NULL,
	"status" "media_status" DEFAULT 'uploading' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_media_files_tenant_id" UNIQUE("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "service_media" (
	"business_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"media_file_id" uuid NOT NULL,
	"purpose" "service_media_purpose" NOT NULL,
	"sort_order" integer DEFAULT 0,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "service_media_service_id_media_file_id_pk" PRIMARY KEY("service_id","media_file_id")
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"notification_id" uuid NOT NULL,
	"business_id" uuid,
	"channel" "notification_channel" NOT NULL,
	"status" "delivery_status" DEFAULT 'PENDING' NOT NULL,
	"provider_name" varchar(100),
	"provider_message_id" varchar(255),
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"error_code" varchar(100),
	"error_message" text,
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_notif_deliv_attempt" CHECK ("notification_deliveries"."attempt_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"event_key" varchar(150) NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"sms_enabled" boolean DEFAULT true NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_notif_pref_at_least_one" CHECK ("notification_preferences"."email_enabled" OR "notification_preferences"."sms_enabled" OR "notification_preferences"."push_enabled" OR "notification_preferences"."in_app_enabled")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"business_id" uuid,
	"event_key" varchar(150) NOT NULL,
	"payload" jsonb NOT NULL,
	"priority" "notification_priority" DEFAULT 'NORMAL' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_responses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"business_member_id" uuid NOT NULL,
	"responder_type" "responder_type" NOT NULL,
	"visibility" "response_visibility" DEFAULT 'public' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_review_responses_body" CHECK (length(trim("review_responses"."body")) > 0)
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"business_customer_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"title" text,
	"comment" text,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"moderated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_reviews_tenant_id" UNIQUE("business_id","id"),
	CONSTRAINT "chk_reviews_rating" CHECK ("reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "branch_services" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"is_bookable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_service_categories_tenant" UNIQUE("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"default_price" numeric(10, 2) NOT NULL,
	"default_duration_minutes" smallint NOT NULL,
	"buffer_before_minutes" smallint DEFAULT 0 NOT NULL,
	"buffer_after_minutes" smallint DEFAULT 0 NOT NULL,
	"color" text,
	"is_bookable" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_services_tenant_id" UNIQUE("business_id","id"),
	CONSTRAINT "chk_services_default_price" CHECK ("services"."default_price" >= 0),
	CONSTRAINT "chk_services_duration" CHECK ("services"."default_duration_minutes" > 0),
	CONSTRAINT "chk_services_buffer_before" CHECK ("services"."buffer_before_minutes" >= 0),
	CONSTRAINT "chk_services_buffer_after" CHECK ("services"."buffer_after_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "staff_services" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"staff_member_id" uuid NOT NULL,
	"override_price" numeric(10, 2),
	"override_duration_minutes" smallint,
	"is_bookable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_staff_services_override_price" CHECK ("staff_services"."override_price" IS NULL OR "staff_services"."override_price" >= 0),
	CONSTRAINT "chk_staff_services_override_duration" CHECK ("staff_services"."override_duration_minutes" IS NULL OR "staff_services"."override_duration_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "staff_branch_assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"staff_member_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unassigned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"business_member_id" uuid NOT NULL,
	"status" "staff_status" DEFAULT 'active' NOT NULL,
	"display_name" text NOT NULL,
	"job_title" text,
	"biography" text,
	"avatar_media_id" uuid,
	"employment_type" "employment_type" DEFAULT 'full_time' NOT NULL,
	"hire_date" date,
	"exclude_from_auto_assignment" boolean DEFAULT false NOT NULL,
	"languages" text[],
	"social_links" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_staff_tenant_id" UNIQUE("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "staff_portfolio" (
	"business_id" uuid NOT NULL,
	"staff_member_id" uuid NOT NULL,
	"media_file_id" uuid NOT NULL,
	"service_id" uuid,
	"caption" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "staff_portfolio_staff_member_id_media_file_id_pk" PRIMARY KEY("staff_member_id","media_file_id")
);
--> statement-breakpoint
CREATE TABLE "staff_schedule_shifts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"work_schedule_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"starts_at" time NOT NULL,
	"ends_at" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_staff_shifts_day" CHECK ("staff_schedule_shifts"."day_of_week" BETWEEN 1 AND 7)
);
--> statement-breakpoint
CREATE TABLE "staff_time_off" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"staff_member_id" uuid NOT NULL,
	"reason" time_off_reason DEFAULT 'unavailable' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"notes" text,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_staff_time_off_dates" CHECK ("staff_time_off"."starts_at" < "staff_time_off"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "staff_work_schedules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"staff_member_id" uuid NOT NULL,
	"recurrence_pattern" "schedule_recurrence" DEFAULT 'weekly' NOT NULL,
	"effective_from" date NOT NULL,
	"effective_until" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_work_schedule_dates" CHECK ("staff_work_schedules"."effective_until" IS NULL OR "staff_work_schedules"."effective_from" <= "staff_work_schedules"."effective_until")
);
--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "uq_branches_tenant" UNIQUE("business_id","id");--> statement-breakpoint
ALTER TABLE "business_members" ADD CONSTRAINT "uq_bus_members_tenant_id" UNIQUE("business_id","id");--> statement-breakpoint
ALTER TABLE "business_members" DROP CONSTRAINT "business_members_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "social_links" jsonb;--> statement-breakpoint
ALTER TABLE "appointment_notes" ADD CONSTRAINT "appointment_notes_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_notes" ADD CONSTRAINT "appointment_notes_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_notes" ADD CONSTRAINT "appointment_notes_author_id_business_members_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."business_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "fk_app_svc_appointment_tenant" FOREIGN KEY ("business_id","appointment_id") REFERENCES "public"."appointments"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "fk_app_svc_service_tenant" FOREIGN KEY ("business_id","service_id") REFERENCES "public"."services"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "fk_app_svc_staff_tenant" FOREIGN KEY ("business_id","staff_member_id") REFERENCES "public"."staff_members"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appointment_status_history_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appointment_status_history_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appointment_status_history_changed_by_business_member_id_business_members_id_fk" FOREIGN KEY ("changed_by_business_member_id") REFERENCES "public"."business_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appointment_status_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_business_member_id_business_members_id_fk" FOREIGN KEY ("created_by_business_member_id") REFERENCES "public"."business_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_cancelled_by_business_member_id_business_members_id_fk" FOREIGN KEY ("cancelled_by_business_member_id") REFERENCES "public"."business_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "fk_appointment_branch_tenant" FOREIGN KEY ("business_id","branch_id") REFERENCES "public"."branches"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "fk_appointment_customer_tenant" FOREIGN KEY ("business_id","business_customer_id") REFERENCES "public"."business_customers"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_customers" ADD CONSTRAINT "business_customers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_customers" ADD CONSTRAINT "business_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_favorites" ADD CONSTRAINT "customer_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_favorites" ADD CONSTRAINT "customer_favorites_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_favorites" ADD CONSTRAINT "customer_favorites_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_business_customer_id_business_customers_id_fk" FOREIGN KEY ("business_customer_id") REFERENCES "public"."business_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_author_id_business_members_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."business_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_tag_assignments" ADD CONSTRAINT "customer_tag_assignments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_tag_assignments" ADD CONSTRAINT "customer_tag_assignments_assigned_by_business_members_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."business_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_tag_assignments" ADD CONSTRAINT "fk_customer_tag_assign_customer_tenant" FOREIGN KEY ("business_id","business_customer_id") REFERENCES "public"."business_customers"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_tag_assignments" ADD CONSTRAINT "fk_customer_tag_assign_tag_tenant" FOREIGN KEY ("business_id","customer_tag_id") REFERENCES "public"."customer_tags"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_media" ADD CONSTRAINT "service_media_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_media" ADD CONSTRAINT "service_media_business_id_service_id_services_business_id_id_fk" FOREIGN KEY ("business_id","service_id") REFERENCES "public"."services"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_media" ADD CONSTRAINT "service_media_business_id_media_file_id_media_files_business_id_id_fk" FOREIGN KEY ("business_id","media_file_id") REFERENCES "public"."media_files"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_responses" ADD CONSTRAINT "fk_review_resp_review_tenant" FOREIGN KEY ("business_id","review_id") REFERENCES "public"."reviews"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_responses" ADD CONSTRAINT "fk_review_resp_member_tenant" FOREIGN KEY ("business_id","business_member_id") REFERENCES "public"."business_members"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "fk_review_appointment_tenant" FOREIGN KEY ("business_id","appointment_id") REFERENCES "public"."appointments"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "fk_review_customer_tenant" FOREIGN KEY ("business_id","business_customer_id") REFERENCES "public"."business_customers"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_services" ADD CONSTRAINT "branch_services_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_services" ADD CONSTRAINT "fk_branch_services_service_tenant" FOREIGN KEY ("business_id","service_id") REFERENCES "public"."services"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_services" ADD CONSTRAINT "fk_branch_services_branch_tenant" FOREIGN KEY ("business_id","branch_id") REFERENCES "public"."branches"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "fk_services_category_tenant" FOREIGN KEY ("business_id","category_id") REFERENCES "public"."service_categories"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "fk_staff_services_staff_tenant" FOREIGN KEY ("business_id","staff_member_id") REFERENCES "public"."staff_members"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "fk_staff_services_service_tenant" FOREIGN KEY ("business_id","service_id") REFERENCES "public"."services"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_branch_assignments" ADD CONSTRAINT "staff_branch_assignments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_branch_assignments" ADD CONSTRAINT "fk_staff_branch_assignment_staff_tenant" FOREIGN KEY ("business_id","staff_member_id") REFERENCES "public"."staff_members"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_branch_assignments" ADD CONSTRAINT "fk_staff_branch_assignment_branch_tenant" FOREIGN KEY ("business_id","branch_id") REFERENCES "public"."branches"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "fk_staff_business_member_tenant" FOREIGN KEY ("business_id","business_member_id") REFERENCES "public"."business_members"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_portfolio" ADD CONSTRAINT "staff_portfolio_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_portfolio" ADD CONSTRAINT "staff_portfolio_business_id_staff_member_id_staff_members_business_id_id_fk" FOREIGN KEY ("business_id","staff_member_id") REFERENCES "public"."staff_members"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_portfolio" ADD CONSTRAINT "staff_portfolio_business_id_media_file_id_media_files_business_id_id_fk" FOREIGN KEY ("business_id","media_file_id") REFERENCES "public"."media_files"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_portfolio" ADD CONSTRAINT "staff_portfolio_business_id_service_id_services_business_id_id_fk" FOREIGN KEY ("business_id","service_id") REFERENCES "public"."services"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_schedule_shifts" ADD CONSTRAINT "staff_schedule_shifts_work_schedule_id_staff_work_schedules_id_fk" FOREIGN KEY ("work_schedule_id") REFERENCES "public"."staff_work_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_time_off" ADD CONSTRAINT "staff_time_off_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_time_off" ADD CONSTRAINT "staff_time_off_approved_by_business_members_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."business_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_time_off" ADD CONSTRAINT "fk_staff_time_off_staff_tenant" FOREIGN KEY ("business_id","staff_member_id") REFERENCES "public"."staff_members"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_work_schedules" ADD CONSTRAINT "staff_work_schedules_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_work_schedules" ADD CONSTRAINT "fk_staff_work_schedule_staff_tenant" FOREIGN KEY ("business_id","staff_member_id") REFERENCES "public"."staff_members"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_appt_notes_appointment" ON "appointment_notes" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "idx_appt_notes_author" ON "appointment_notes" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_appt_services_business" ON "appointment_services" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_appt_services_appointment" ON "appointment_services" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "idx_appt_services_staff" ON "appointment_services" USING btree ("staff_member_id");--> statement-breakpoint
CREATE INDEX "idx_appt_services_starts" ON "appointment_services" USING btree ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_appt_services_sequence" ON "appointment_services" USING btree ("appointment_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_appt_history_business" ON "appointment_status_history" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_appt_history_appointment" ON "appointment_status_history" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "idx_appointments_business" ON "appointments" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_appointments_branch" ON "appointments" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_appointments_customer" ON "appointments" USING btree ("business_customer_id");--> statement-breakpoint
CREATE INDEX "idx_appointments_status" ON "appointments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_appointments_start_time" ON "appointments" USING btree ("scheduled_start_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_business" ON "audit_logs" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_actor" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_resource" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_occurred_at" ON "audit_logs" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_bus_customers_business" ON "business_customers" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_bus_customers_user" ON "business_customers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bus_customers_phone" ON "business_customers" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "idx_bus_customers_status" ON "business_customers" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_bus_customers_email" ON "business_customers" USING btree ("business_id",lower("email")) WHERE "business_customers"."email" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_favorites_user" ON "customer_favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_favorites_business" ON "customer_favorites" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_favorites_staff" ON "customer_favorites" USING btree ("staff_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_favorites_user_business" ON "customer_favorites" USING btree ("user_id","business_id") WHERE "customer_favorites"."business_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_favorites_user_staff" ON "customer_favorites" USING btree ("user_id","staff_member_id") WHERE "customer_favorites"."staff_member_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_customer_notes_business" ON "customer_notes" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_customer_notes_customer" ON "customer_notes" USING btree ("business_customer_id");--> statement-breakpoint
CREATE INDEX "idx_customer_notes_author" ON "customer_notes" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_customer_tag_assign_tag" ON "customer_tag_assignments" USING btree ("customer_tag_id");--> statement-breakpoint
CREATE INDEX "idx_customer_tag_assign_biz" ON "customer_tag_assignments" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_customer_tags_business" ON "customer_tags" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_customer_tags_business_name" ON "customer_tags" USING btree ("business_id","name");--> statement-breakpoint
CREATE INDEX "idx_media_files_business" ON "media_files" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_media_files_uploader" ON "media_files" USING btree ("uploaded_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_media_files_status" ON "media_files" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_media_files_storage_key" ON "media_files" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "idx_notif_deliv_notification" ON "notification_deliveries" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "idx_notif_deliv_business" ON "notification_deliveries" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_notif_deliv_status_schedule" ON "notification_deliveries" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_notif_deliv_provider_msg" ON "notification_deliveries" USING btree ("provider_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_notif_attempt" ON "notification_deliveries" USING btree ("notification_id","channel","attempt_number");--> statement-breakpoint
CREATE INDEX "idx_notif_pref_user" ON "notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notif_pref_event" ON "notification_preferences" USING btree ("event_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_notif_preference" ON "notification_preferences" USING btree ("user_id","event_key");--> statement-breakpoint
CREATE INDEX "idx_notifications_recipient" ON "notifications" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_business" ON "notifications" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_event" ON "notifications" USING btree ("event_key");--> statement-breakpoint
CREATE INDEX "idx_notifications_schedule" ON "notifications" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_notifications_created_at" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_review_responses_business" ON "review_responses" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_review_responses_member" ON "review_responses" USING btree ("business_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_review_responses_review" ON "review_responses" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "idx_reviews_business" ON "reviews" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_reviews_rating" ON "reviews" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "idx_reviews_created_at" ON "reviews" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reviews_appointment" ON "reviews" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "idx_branch_services_branch" ON "branch_services" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_branch_services_service" ON "branch_services" USING btree ("service_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_branch_services_branch_service" ON "branch_services" USING btree ("branch_id","service_id");--> statement-breakpoint
CREATE INDEX "idx_service_categories_business" ON "service_categories" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_service_categories_order" ON "service_categories" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "idx_service_categories_active" ON "service_categories" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_service_categories_business_name" ON "service_categories" USING btree ("business_id","name");--> statement-breakpoint
CREATE INDEX "idx_services_business" ON "services" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_services_category" ON "services" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_services_bookable" ON "services" USING btree ("is_bookable");--> statement-breakpoint
CREATE INDEX "idx_services_active" ON "services" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_services_business_name" ON "services" USING btree ("business_id","name");--> statement-breakpoint
CREATE INDEX "idx_staff_services_staff" ON "staff_services" USING btree ("staff_member_id");--> statement-breakpoint
CREATE INDEX "idx_staff_services_service" ON "staff_services" USING btree ("service_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_staff_services_staff_service" ON "staff_services" USING btree ("staff_member_id","service_id");--> statement-breakpoint
CREATE INDEX "idx_staff_branch_assign_staff" ON "staff_branch_assignments" USING btree ("staff_member_id");--> statement-breakpoint
CREATE INDEX "idx_staff_branch_assign_branch" ON "staff_branch_assignments" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_staff_primary_branch" ON "staff_branch_assignments" USING btree ("staff_member_id") WHERE "staff_branch_assignments"."is_primary" = TRUE AND "staff_branch_assignments"."unassigned_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_staff_members_business" ON "staff_members" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_staff_members_status" ON "staff_members" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_staff_members_exclude_from_auto_assignment" ON "staff_members" USING btree ("exclude_from_auto_assignment");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_staff_business_member" ON "staff_members" USING btree ("business_id","business_member_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_business" ON "staff_portfolio" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_service" ON "staff_portfolio" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "idx_staff_shifts_schedule" ON "staff_schedule_shifts" USING btree ("work_schedule_id");--> statement-breakpoint
CREATE INDEX "idx_staff_shifts_day" ON "staff_schedule_shifts" USING btree ("day_of_week");--> statement-breakpoint
CREATE INDEX "idx_staff_time_off_staff" ON "staff_time_off" USING btree ("staff_member_id");--> statement-breakpoint
CREATE INDEX "idx_staff_time_off_dates" ON "staff_time_off" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "idx_staff_schedules_staff" ON "staff_work_schedules" USING btree ("staff_member_id");--> statement-breakpoint
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
