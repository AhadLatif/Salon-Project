ALTER TABLE "user_sessions" DROP CONSTRAINT "user_sessions_auth_provider_id_user_auth_providers_id_fk";
--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_auth_provider_id_user_auth_providers_id_fk" FOREIGN KEY ("auth_provider_id") REFERENCES "public"."user_auth_providers"("id") ON DELETE cascade ON UPDATE no action;