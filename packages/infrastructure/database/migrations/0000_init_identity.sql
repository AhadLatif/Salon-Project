CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."auth_provider" AS ENUM('email', 'google', 'apple', 'microsoft');--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('desktop', 'mobile', 'tablet', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."session_revoke_reason" AS ENUM('logout', 'logout_all', 'compromised', 'expired', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_token_type" AS ENUM('email_verification', 'password_reset', 'email_change', 'magic_link', 'invitation');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"primary_email" varchar(320) NOT NULL,
	"primary_phone" varchar(20),
	"avatar_url" text,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"phone_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_users_first_name" CHECK (length(trim("users"."first_name")) > 0),
	CONSTRAINT "chk_users_last_name" CHECK (length(trim("users"."last_name")) > 0),
	CONSTRAINT "chk_users_primary_phone_e164" CHECK ("users"."primary_phone" IS NULL
          OR "users"."primary_phone" ~ '^\+[1-9][0-9]{1,14}$')
);
--> statement-breakpoint
CREATE TABLE "user_auth_providers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "auth_provider" NOT NULL,
	"provider_user_id" varchar(255) NOT NULL,
	"provider_email" varchar(320),
	"provider_email_verified_at" timestamp with time zone,
	"password_hash" text,
	"provider_profile" jsonb,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_provider_user_id" CHECK (length(trim("user_auth_providers"."provider_user_id")) > 0),
	CONSTRAINT "chk_email_provider_password" CHECK (
      (
        "user_auth_providers"."provider" = 'email'
        AND "user_auth_providers"."password_hash" IS NOT NULL
      )
      OR
      (
        "user_auth_providers"."provider" <> 'email'
        AND "user_auth_providers"."password_hash" IS NULL
      )
    )
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"auth_provider_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"device_name" varchar(255),
	"device_type" "device_type" DEFAULT 'unknown' NOT NULL,
	"user_agent" text,
	"created_ip" "inet",
	"last_ip" "inet",
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoke_reason" "session_revoke_reason",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_user_sessions_expiry" CHECK ("user_sessions"."expires_at" > "user_sessions"."created_at"),
	CONSTRAINT "chk_user_sessions_revocation" CHECK (
        (
          "user_sessions"."revoked_at" IS NULL
          AND "user_sessions"."revoke_reason" IS NULL
        )
        OR
        (
          "user_sessions"."revoked_at" IS NOT NULL
          AND "user_sessions"."revoke_reason" IS NOT NULL
        )
      )
);
--> statement-breakpoint
CREATE TABLE "user_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_type" "user_token_type" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"context" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_user_tokens_expiry" CHECK ("user_tokens"."expires_at" > "user_tokens"."created_at"),
	CONSTRAINT "chk_user_tokens_consumed" CHECK (
        "user_tokens"."consumed_at" IS NULL
        OR
        "user_tokens"."consumed_at" <= "user_tokens"."expires_at"
      )
);
--> statement-breakpoint
ALTER TABLE "user_auth_providers" ADD CONSTRAINT "user_auth_providers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_auth_provider_id_user_auth_providers_id_fk" FOREIGN KEY ("auth_provider_id") REFERENCES "public"."user_auth_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_users_status" ON "users" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_primary_email" ON "users" USING btree (lower("primary_email"));--> statement-breakpoint
CREATE INDEX "idx_user_auth_providers_user" ON "user_auth_providers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_auth_providers_last_used" ON "user_auth_providers" USING btree ("last_used_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_auth_provider" ON "user_auth_providers" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_email_provider" ON "user_auth_providers" USING btree (lower("provider_email")) WHERE "user_auth_providers"."provider" = 'email';--> statement-breakpoint
CREATE INDEX "idx_user_sessions_user" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_provider" ON "user_sessions" USING btree ("auth_provider_id");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_expires" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_last_used" ON "user_sessions" USING btree ("last_used_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_sessions_refresh_token_hash" ON "user_sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "idx_user_tokens_user" ON "user_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_tokens_type" ON "user_tokens" USING btree ("token_type");--> statement-breakpoint
CREATE INDEX "idx_user_tokens_expires" ON "user_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_user_tokens_consumed" ON "user_tokens" USING btree ("consumed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_tokens_hash" ON "user_tokens" USING btree ("token_hash");