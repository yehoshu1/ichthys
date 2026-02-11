CREATE TYPE "public"."notification_delivery_channel" AS ENUM('DISCORD_CHANNEL', 'WEBHOOK');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."notification_digest_mode" AS ENUM('OFF', 'HOURLY', 'DAILY');--> statement-breakpoint
CREATE TYPE "public"."notification_severity" AS ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."notification_source" AS ENUM('BOT_EVENT', 'BOT_JOB', 'DASHBOARD_API');--> statement-breakpoint
CREATE TABLE "notification_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"guild_id" text NOT NULL,
	"channel_type" "notification_delivery_channel" NOT NULL,
	"target" text NOT NULL,
	"status" "notification_delivery_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"event_type" text NOT NULL,
	"severity" "notification_severity" DEFAULT 'INFO' NOT NULL,
	"source" "notification_source" DEFAULT 'BOT_EVENT' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"actor_user_id" text,
	"target_user_id" text,
	"entity_type" text,
	"entity_id" text,
	"metadata" jsonb,
	"dedupe_key" text,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"in_app_visible" boolean DEFAULT true NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"event_type" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"min_severity" "notification_severity" DEFAULT 'INFO' NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"discord_channel_enabled" boolean DEFAULT false NOT NULL,
	"discord_channel_id" text,
	"webhook_enabled" boolean DEFAULT false NOT NULL,
	"webhook_url" text,
	"digest_mode" "notification_digest_mode" DEFAULT 'OFF' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_user_cursor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_user_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"pinned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_notification_id_notification_event_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notification_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_event" ADD CONSTRAINT "notification_event_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_user_cursor" ADD CONSTRAINT "notification_user_cursor_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_user_state" ADD CONSTRAINT "notification_user_state_notification_id_notification_event_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notification_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_delivery_status_next_attempt_idx" ON "notification_delivery" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notification_delivery_notification_idx" ON "notification_delivery" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "notification_delivery_guild_status_idx" ON "notification_delivery" USING btree ("guild_id","status");--> statement-breakpoint
CREATE INDEX "notification_event_guild_occurred_idx" ON "notification_event" USING btree ("guild_id","occurred_at");--> statement-breakpoint
CREATE INDEX "notification_event_guild_type_occurred_idx" ON "notification_event" USING btree ("guild_id","event_type","occurred_at");--> statement-breakpoint
CREATE INDEX "notification_event_guild_severity_occurred_idx" ON "notification_event" USING btree ("guild_id","severity","occurred_at");--> statement-breakpoint
CREATE INDEX "notification_event_guild_dedupe_idx" ON "notification_event" USING btree ("guild_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notification_event_guild_visible_occurred_idx" ON "notification_event" USING btree ("guild_id","in_app_visible","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preference_guild_event_unique" ON "notification_preference" USING btree ("guild_id","event_type");--> statement-breakpoint
CREATE INDEX "notification_preference_guild_id_idx" ON "notification_preference" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_user_cursor_guild_user_unique" ON "notification_user_cursor" USING btree ("guild_id","user_id");--> statement-breakpoint
CREATE INDEX "notification_user_cursor_guild_seen_idx" ON "notification_user_cursor" USING btree ("guild_id","last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_user_state_notification_user_unique" ON "notification_user_state" USING btree ("notification_id","user_id");--> statement-breakpoint
CREATE INDEX "notification_user_state_user_read_idx" ON "notification_user_state" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "notification_user_state_user_archived_idx" ON "notification_user_state" USING btree ("user_id","archived_at");