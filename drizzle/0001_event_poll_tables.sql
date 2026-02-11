-- Event and Poll Management Tables Migration
-- Created for ΙΧΘΥΣ Discord Bot

-- ═══════════════════════════════════════════════════════════════════════════════
-- ENUM TYPES
-- ═══════════════════════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════════════════════
-- EVENT MANAGEMENT TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "event" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "guild_id" text NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
    "creator_id" text NOT NULL,
    "message_id" text,
    "channel_id" text NOT NULL,
    "title" text NOT NULL,
    "description" text,
    "location" text,
    "image_url" text,
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
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS event_guild_id_idx ON "event" ("guild_id");
CREATE INDEX IF NOT EXISTS event_guild_start_time_idx ON "event" ("guild_id", "start_time");
CREATE INDEX IF NOT EXISTS event_guild_status_idx ON "event" ("guild_id", "status");
CREATE INDEX IF NOT EXISTS event_start_time_idx ON "event" ("start_time");
CREATE INDEX IF NOT EXISTS event_status_start_time_idx ON "event" ("status", "start_time");

CREATE TABLE IF NOT EXISTS "event_rsvp" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "event_id" uuid NOT NULL REFERENCES "event"(id) ON DELETE CASCADE,
    "user_id" text NOT NULL,
    "status" rsvp_status DEFAULT 'YES' NOT NULL,
    "responded_at" timestamp with time zone DEFAULT now() NOT NULL,
    "note" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS event_rsvp_event_user_unique ON "event_rsvp" ("event_id", "user_id");
CREATE INDEX IF NOT EXISTS event_rsvp_event_id_idx ON "event_rsvp" ("event_id");
CREATE INDEX IF NOT EXISTS event_rsvp_user_id_idx ON "event_rsvp" ("user_id");
CREATE INDEX IF NOT EXISTS event_rsvp_status_idx ON "event_rsvp" ("status");

CREATE TABLE IF NOT EXISTS "event_reminder" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "event_id" uuid NOT NULL REFERENCES "event"(id) ON DELETE CASCADE,
    "user_id" text NOT NULL,
    "minutes_before" integer NOT NULL,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS event_reminder_event_user_minutes_unique ON "event_reminder" ("event_id", "user_id", "minutes_before");
CREATE INDEX IF NOT EXISTS event_reminder_event_id_idx ON "event_reminder" ("event_id");
CREATE INDEX IF NOT EXISTS event_reminder_user_id_idx ON "event_reminder" ("user_id");
CREATE INDEX IF NOT EXISTS event_reminder_sent_at_idx ON "event_reminder" ("sent_at");

CREATE TABLE IF NOT EXISTS "event_template" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "guild_id" text NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
    "creator_id" text NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "title" text,
    "location" text,
    "duration_minutes" integer,
    "max_attendees" integer,
    "enable_waitlist" boolean DEFAULT false NOT NULL,
    "mention_role_ids" text[],
    "required_role_ids" text[],
    "blocked_role_ids" text[],
    "attendee_role_id" text,
    "image_url" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS event_template_guild_name_unique ON "event_template" ("guild_id", "name");
CREATE INDEX IF NOT EXISTS event_template_guild_id_idx ON "event_template" ("guild_id");

CREATE TABLE IF NOT EXISTS "user_timezone" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" text UNIQUE NOT NULL,
    "timezone" text DEFAULT 'UTC' NOT NULL,
    "detected_automatically" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS user_timezone_user_id_idx ON "user_timezone" ("user_id");

-- ═══════════════════════════════════════════════════════════════════════════════
-- POLLING TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "poll" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "guild_id" text NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
    "creator_id" text NOT NULL,
    "message_id" text,
    "channel_id" text NOT NULL,
    "question" text NOT NULL,
    "description" text,
    "type" poll_type DEFAULT 'STANDARD' NOT NULL,
    "allow_multiple_votes" boolean DEFAULT false NOT NULL,
    "max_votes_per_user" integer,
    "allow_custom_options" boolean DEFAULT false NOT NULL,
    "allowed_role_ids" text[],
    "end_time" timestamp with time zone,
    "closed" boolean DEFAULT false NOT NULL,
    "closed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS poll_guild_id_idx ON "poll" ("guild_id");
CREATE INDEX IF NOT EXISTS poll_guild_closed_idx ON "poll" ("guild_id", "closed");
CREATE INDEX IF NOT EXISTS poll_end_time_idx ON "poll" ("end_time");

CREATE TABLE IF NOT EXISTS "poll_option" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "poll_id" uuid NOT NULL REFERENCES "poll"(id) ON DELETE CASCADE,
    "option_index" integer NOT NULL,
    "text" text NOT NULL,
    "emoji" text,
    "date_time_value" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS poll_option_poll_index_unique ON "poll_option" ("poll_id", "option_index");
CREATE INDEX IF NOT EXISTS poll_option_poll_id_idx ON "poll_option" ("poll_id");

CREATE TABLE IF NOT EXISTS "poll_vote" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "poll_id" uuid NOT NULL REFERENCES "poll"(id) ON DELETE CASCADE,
    "option_id" uuid NOT NULL REFERENCES "poll_option"(id) ON DELETE CASCADE,
    "user_id" text NOT NULL,
    "voted_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS poll_vote_poll_user_option_unique ON "poll_vote" ("poll_id", "user_id", "option_id");
CREATE INDEX IF NOT EXISTS poll_vote_poll_id_idx ON "poll_vote" ("poll_id");
CREATE INDEX IF NOT EXISTS poll_vote_option_id_idx ON "poll_vote" ("option_id");
CREATE INDEX IF NOT EXISTS poll_vote_user_id_idx ON "poll_vote" ("user_id");

-- ═══════════════════════════════════════════════════════════════════════════════
-- AVAILABILITY FINDER TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "availability_finder" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "guild_id" text NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
    "creator_id" text NOT NULL,
    "message_id" text,
    "channel_id" text NOT NULL,
    "title" text NOT NULL,
    "description" text,
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone NOT NULL,
    "daily_start_hour" integer DEFAULT 9 NOT NULL,
    "daily_end_hour" integer DEFAULT 17 NOT NULL,
    "is_public" boolean DEFAULT true NOT NULL,
    "closed" boolean DEFAULT false NOT NULL,
    "convert_to_event" boolean DEFAULT false NOT NULL,
    "created_event_id" uuid REFERENCES "event"(id),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS availability_finder_guild_id_idx ON "availability_finder" ("guild_id");
CREATE INDEX IF NOT EXISTS availability_finder_guild_closed_idx ON "availability_finder" ("guild_id", "closed");

CREATE TABLE IF NOT EXISTS "availability_response" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "finder_id" uuid NOT NULL REFERENCES "availability_finder"(id) ON DELETE CASCADE,
    "user_id" text NOT NULL,
    "available_slots" timestamp with time zone[],
    "responded_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS availability_response_finder_user_unique ON "availability_response" ("finder_id", "user_id");
CREATE INDEX IF NOT EXISTS availability_response_finder_id_idx ON "availability_response" ("finder_id");

-- ═══════════════════════════════════════════════════════════════════════════════
-- SETTINGS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "event_poll_settings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "guild_id" text NOT NULL UNIQUE REFERENCES guild_config(guild_id) ON DELETE CASCADE,
    "default_event_channel_id" text,
    "default_poll_channel_id" text,
    "default_mention_on_create" boolean DEFAULT false NOT NULL,
    "default_mention_on_start" boolean DEFAULT false NOT NULL,
    "allowed_event_creators" text[],
    "allowed_poll_creators" text[],
    "server_timezone" text DEFAULT 'UTC' NOT NULL,
    "ai_enabled" boolean DEFAULT true NOT NULL,
    "ai_rate_limit_per_hour" integer DEFAULT 10 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS event_poll_settings_guild_unique ON "event_poll_settings" ("guild_id");
