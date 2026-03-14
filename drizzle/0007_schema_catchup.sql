-- Catch-up migration for schema changes that were added outside the tracked Drizzle journal.
-- This brings databases migrated through 0002_fast_wolf_cub.sql up to the current schema.

DO $$ BEGIN
    CREATE TYPE event_status AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE rsvp_status AS ENUM ('YES', 'NO', 'MAYBE', 'WAITLIST');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE poll_type AS ENUM ('STANDARD', 'TIME', 'ANONYMOUS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE repeat_frequency AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "module_state" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "guild_id" text NOT NULL,
    "module_id" text NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "updated_by" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "module_state_guild_id_guild_config_guild_id_fk"
        FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id")
        ON DELETE cascade ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "module_state_guild_module_unique" ON "module_state" USING btree ("guild_id","module_id");
CREATE INDEX IF NOT EXISTS "module_state_guild_id_idx" ON "module_state" USING btree ("guild_id");

ALTER TABLE "welcome_config"
    ADD COLUMN IF NOT EXISTS "image_send_mode" text DEFAULT 'WITH_TEXT',
    ADD COLUMN IF NOT EXISTS "image_channel_id" text,
    ADD COLUMN IF NOT EXISTS "canvas_width" integer DEFAULT 400,
    ADD COLUMN IF NOT EXISTS "canvas_height" integer DEFAULT 200,
    ADD COLUMN IF NOT EXISTS "goodbye_enabled" boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS "goodbye_channel_id" text,
    ADD COLUMN IF NOT EXISTS "goodbye_message_template" text,
    ADD COLUMN IF NOT EXISTS "goodbye_embed_enabled" boolean DEFAULT false NOT NULL;

ALTER TABLE "welcome_config" DROP COLUMN IF EXISTS "image_position";

ALTER TABLE "welcome_config"
    ALTER COLUMN "avatar_x" SET DEFAULT 155,
    ALTER COLUMN "avatar_y" SET DEFAULT 10,
    ALTER COLUMN "avatar_size" SET DEFAULT 90,
    ALTER COLUMN "avatar_border_width" SET DEFAULT 0,
    ALTER COLUMN "username_x" SET DEFAULT 200,
    ALTER COLUMN "username_y" SET DEFAULT 115,
    ALTER COLUMN "username_size" SET DEFAULT 18,
    ALTER COLUMN "username_align" SET DEFAULT 'center',
    ALTER COLUMN "subtitle_x" SET DEFAULT 200,
    ALTER COLUMN "subtitle_y" SET DEFAULT 140,
    ALTER COLUMN "subtitle_size" SET DEFAULT 16,
    ALTER COLUMN "subtitle_color" SET DEFAULT '#ffffff',
    ALTER COLUMN "background_value" SET DEFAULT 'transparent';

CREATE TABLE IF NOT EXISTS "event" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "guild_id" text NOT NULL,
    "creator_id" text NOT NULL,
    "message_id" text,
    "channel_id" text NOT NULL,
    "title" text NOT NULL,
    "description" text,
    "location" text,
    "location_channel_id" text,
    "image_url" text,
    "color" text,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone,
    "duration_minutes" integer,
    "status" event_status DEFAULT 'SCHEDULED' NOT NULL,
    "max_attendees" integer,
    "enable_waitlist" boolean DEFAULT false NOT NULL,
    "close_rsvp_before_start_minutes" integer,
    "mention_role_ids" text[],
    "mention_on_create" boolean DEFAULT false NOT NULL,
    "mention_on_start" boolean DEFAULT false NOT NULL,
    "required_role_ids" text[],
    "blocked_role_ids" text[],
    "attendee_role_id" text,
    "repeat_frequency" repeat_frequency DEFAULT 'NONE' NOT NULL,
    "repeat_until" timestamp with time zone,
    "parent_event_id" uuid,
    "mirror_to_discord" boolean DEFAULT true NOT NULL,
    "discord_scheduled_event_id" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "event_guild_id_guild_config_guild_id_fk"
        FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id")
        ON DELETE cascade ON UPDATE no action
);

ALTER TABLE "event"
    ADD COLUMN IF NOT EXISTS "location_channel_id" text,
    ADD COLUMN IF NOT EXISTS "color" text,
    ADD COLUMN IF NOT EXISTS "mirror_to_discord" boolean DEFAULT true NOT NULL,
    ADD COLUMN IF NOT EXISTS "discord_scheduled_event_id" text;

CREATE INDEX IF NOT EXISTS "event_guild_id_idx" ON "event" USING btree ("guild_id");
CREATE INDEX IF NOT EXISTS "event_guild_start_time_idx" ON "event" USING btree ("guild_id","start_time");
CREATE INDEX IF NOT EXISTS "event_guild_status_idx" ON "event" USING btree ("guild_id","status");
CREATE INDEX IF NOT EXISTS "event_start_time_idx" ON "event" USING btree ("start_time");
CREATE INDEX IF NOT EXISTS "event_status_start_time_idx" ON "event" USING btree ("status","start_time");

CREATE TABLE IF NOT EXISTS "event_rsvp" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "event_id" uuid NOT NULL,
    "user_id" text NOT NULL,
    "status" rsvp_status DEFAULT 'YES' NOT NULL,
    "responded_at" timestamp with time zone DEFAULT now() NOT NULL,
    "note" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "event_rsvp_event_id_event_id_fk"
        FOREIGN KEY ("event_id") REFERENCES "public"."event"("id")
        ON DELETE cascade ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_rsvp_event_user_unique" ON "event_rsvp" USING btree ("event_id","user_id");
CREATE INDEX IF NOT EXISTS "event_rsvp_event_id_idx" ON "event_rsvp" USING btree ("event_id");
CREATE INDEX IF NOT EXISTS "event_rsvp_user_id_idx" ON "event_rsvp" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "event_rsvp_status_idx" ON "event_rsvp" USING btree ("status");

CREATE TABLE IF NOT EXISTS "event_reminder" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "event_id" uuid NOT NULL,
    "user_id" text NOT NULL,
    "minutes_before" integer NOT NULL,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "event_reminder_event_id_event_id_fk"
        FOREIGN KEY ("event_id") REFERENCES "public"."event"("id")
        ON DELETE cascade ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_reminder_event_user_minutes_unique" ON "event_reminder" USING btree ("event_id","user_id","minutes_before");
CREATE INDEX IF NOT EXISTS "event_reminder_event_id_idx" ON "event_reminder" USING btree ("event_id");
CREATE INDEX IF NOT EXISTS "event_reminder_user_id_idx" ON "event_reminder" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "event_reminder_sent_at_idx" ON "event_reminder" USING btree ("sent_at");

CREATE TABLE IF NOT EXISTS "event_template" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "guild_id" text NOT NULL,
    "creator_id" text NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "title" text,
    "location" text,
    "default_color" text,
    "duration_minutes" integer,
    "max_attendees" integer,
    "enable_waitlist" boolean DEFAULT false NOT NULL,
    "mention_role_ids" text[],
    "required_role_ids" text[],
    "blocked_role_ids" text[],
    "attendee_role_id" text,
    "image_url" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "event_template_guild_id_guild_config_guild_id_fk"
        FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id")
        ON DELETE cascade ON UPDATE no action
);
ALTER TABLE "event_template" ADD COLUMN IF NOT EXISTS "default_color" text;
CREATE UNIQUE INDEX IF NOT EXISTS "event_template_guild_name_unique" ON "event_template" USING btree ("guild_id","name");
CREATE INDEX IF NOT EXISTS "event_template_guild_id_idx" ON "event_template" USING btree ("guild_id");

CREATE TABLE IF NOT EXISTS "user_timezone" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" text NOT NULL UNIQUE,
    "timezone" text DEFAULT 'UTC' NOT NULL,
    "detected_automatically" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "user_timezone_user_id_idx" ON "user_timezone" USING btree ("user_id");

CREATE TABLE IF NOT EXISTS "poll" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "guild_id" text NOT NULL,
    "creator_id" text NOT NULL,
    "message_id" text,
    "channel_id" text NOT NULL,
    "question" text NOT NULL,
    "description" text,
    "color" text,
    "type" poll_type DEFAULT 'STANDARD' NOT NULL,
    "allow_multiple_votes" boolean DEFAULT false NOT NULL,
    "max_votes_per_user" integer,
    "allow_custom_options" boolean DEFAULT false NOT NULL,
    "allowed_role_ids" text[],
    "mention_role_ids" text[],
    "mention_on_create" boolean DEFAULT false NOT NULL,
    "end_time" timestamp with time zone,
    "closed" boolean DEFAULT false NOT NULL,
    "closed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "poll_guild_id_guild_config_guild_id_fk"
        FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id")
        ON DELETE cascade ON UPDATE no action
);

ALTER TABLE "poll"
    ADD COLUMN IF NOT EXISTS "color" text,
    ADD COLUMN IF NOT EXISTS "mention_role_ids" text[],
    ADD COLUMN IF NOT EXISTS "mention_on_create" boolean DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS "poll_guild_id_idx" ON "poll" USING btree ("guild_id");
CREATE INDEX IF NOT EXISTS "poll_guild_closed_idx" ON "poll" USING btree ("guild_id","closed");
CREATE INDEX IF NOT EXISTS "poll_end_time_idx" ON "poll" USING btree ("end_time");

CREATE TABLE IF NOT EXISTS "poll_option" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "poll_id" uuid NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "text" text NOT NULL,
    "emoji" text,
    "date_time_value" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "poll_option_poll_id_poll_id_fk"
        FOREIGN KEY ("poll_id") REFERENCES "public"."poll"("id")
        ON DELETE cascade ON UPDATE no action
);

ALTER TABLE "poll_option" ADD COLUMN IF NOT EXISTS "order" integer DEFAULT 0 NOT NULL;
DO $$ BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'poll_option' AND column_name = 'option_index'
    ) THEN
        EXECUTE 'UPDATE "poll_option" SET "order" = "option_index" WHERE "order" = 0';
    END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "poll_option_poll_order_unique" ON "poll_option" USING btree ("poll_id","order");
CREATE INDEX IF NOT EXISTS "poll_option_poll_id_idx" ON "poll_option" USING btree ("poll_id");

CREATE TABLE IF NOT EXISTS "poll_vote" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "poll_id" uuid NOT NULL,
    "option_id" uuid NOT NULL,
    "user_id" text NOT NULL,
    "voted_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "poll_vote_poll_id_poll_id_fk"
        FOREIGN KEY ("poll_id") REFERENCES "public"."poll"("id")
        ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "poll_vote_option_id_poll_option_id_fk"
        FOREIGN KEY ("option_id") REFERENCES "public"."poll_option"("id")
        ON DELETE cascade ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "poll_vote_poll_user_option_unique" ON "poll_vote" USING btree ("poll_id","user_id","option_id");
CREATE INDEX IF NOT EXISTS "poll_vote_poll_id_idx" ON "poll_vote" USING btree ("poll_id");
CREATE INDEX IF NOT EXISTS "poll_vote_option_id_idx" ON "poll_vote" USING btree ("option_id");
CREATE INDEX IF NOT EXISTS "poll_vote_user_id_idx" ON "poll_vote" USING btree ("user_id");

CREATE TABLE IF NOT EXISTS "poll_template" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "guild_id" text NOT NULL,
    "creator_id" text NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "question" text,
    "poll_description" text,
    "type" poll_type DEFAULT 'STANDARD' NOT NULL,
    "allow_multiple_votes" boolean DEFAULT false NOT NULL,
    "max_votes_per_user" integer,
    "allow_custom_options" boolean DEFAULT false NOT NULL,
    "default_options" text[],
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "poll_template_guild_id_guild_config_guild_id_fk"
        FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id")
        ON DELETE cascade ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "poll_template_guild_id_idx" ON "poll_template" USING btree ("guild_id");

CREATE TABLE IF NOT EXISTS "event_poll_settings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "guild_id" text NOT NULL,
    "default_event_channel_id" text,
    "default_poll_channel_id" text,
    "default_mention_on_create" boolean DEFAULT false NOT NULL,
    "default_mention_on_start" boolean DEFAULT false NOT NULL,
    "allowed_event_creators" text[],
    "allowed_poll_creators" text[],
    "server_timezone" text DEFAULT 'UTC' NOT NULL,
    "ai_enabled" boolean DEFAULT true NOT NULL,
    "ai_rate_limit_per_hour" integer DEFAULT 10 NOT NULL,
    "mirror_to_discord_events" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "event_poll_settings_guild_id_guild_config_guild_id_fk"
        FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id")
        ON DELETE cascade ON UPDATE no action
);
ALTER TABLE "event_poll_settings" ADD COLUMN IF NOT EXISTS "mirror_to_discord_events" boolean DEFAULT true NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "event_poll_settings_guild_unique" ON "event_poll_settings" USING btree ("guild_id");

CREATE TABLE IF NOT EXISTS "webhook_endpoint" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "guild_id" text NOT NULL,
    "name" text NOT NULL,
    "url" text NOT NULL,
    "secret" text,
    "event_types" text[] NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "failure_count" integer DEFAULT 0 NOT NULL,
    "last_success_at" timestamp with time zone,
    "last_failure_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "webhook_endpoint_guild_id_guild_config_guild_id_fk"
        FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id")
        ON DELETE cascade ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "webhook_endpoint_guild_id_idx" ON "webhook_endpoint" USING btree ("guild_id");
CREATE INDEX IF NOT EXISTS "webhook_endpoint_guild_enabled_idx" ON "webhook_endpoint" USING btree ("guild_id","enabled");

CREATE TABLE IF NOT EXISTS "webhook_delivery" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "webhook_id" uuid NOT NULL,
    "event_type" text NOT NULL,
    "payload" jsonb NOT NULL,
    "request_started_at" timestamp with time zone,
    "request_completed_at" timestamp with time zone,
    "status_code" integer,
    "response_body" text,
    "success" boolean DEFAULT false NOT NULL,
    "error" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "webhook_delivery_webhook_id_webhook_endpoint_id_fk"
        FOREIGN KEY ("webhook_id") REFERENCES "public"."webhook_endpoint"("id")
        ON DELETE cascade ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "webhook_delivery_webhook_id_idx" ON "webhook_delivery" USING btree ("webhook_id");
CREATE INDEX IF NOT EXISTS "webhook_delivery_created_at_idx" ON "webhook_delivery" USING btree ("created_at");

CREATE TABLE IF NOT EXISTS "api_key" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "guild_id" text NOT NULL,
    "name" text NOT NULL,
    "key_hash" text NOT NULL,
    "permissions" text[] NOT NULL,
    "created_by" text NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "last_used_at" timestamp with time zone,
    "use_count" integer DEFAULT 0 NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "api_key_guild_id_guild_config_guild_id_fk"
        FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id")
        ON DELETE cascade ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "api_key_guild_id_idx" ON "api_key" USING btree ("guild_id");
CREATE INDEX IF NOT EXISTS "api_key_key_hash_idx" ON "api_key" USING btree ("key_hash");

DROP TABLE IF EXISTS "availability_response" CASCADE;
DROP TABLE IF EXISTS "availability_finder" CASCADE;
