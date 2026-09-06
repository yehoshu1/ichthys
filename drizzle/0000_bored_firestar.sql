CREATE TYPE "public"."event_status" AS ENUM('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_channel" AS ENUM('DISCORD_CHANNEL', 'WEBHOOK');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."notification_digest_mode" AS ENUM('OFF', 'HOURLY', 'DAILY');--> statement-breakpoint
CREATE TYPE "public"."notification_severity" AS ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."notification_source" AS ENUM('BOT_EVENT', 'BOT_JOB', 'DASHBOARD_API');--> statement-breakpoint
CREATE TYPE "public"."poll_type" AS ENUM('STANDARD', 'TIME', 'ANONYMOUS');--> statement-breakpoint
CREATE TYPE "public"."rbac_default_access" AS ENUM('manage_guild_only', 'deny');--> statement-breakpoint
CREATE TYPE "public"."repeat_frequency" AS ENUM('NONE', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY');--> statement-breakpoint
CREATE TYPE "public"."role_action_required_logic" AS ENUM('AND', 'OR');--> statement-breakpoint
CREATE TYPE "public"."role_action_trigger" AS ENUM('ADD', 'REMOVE');--> statement-breakpoint
CREATE TYPE "public"."role_action_type" AS ENUM('DM', 'KICK', 'LOG', 'MSG', 'MESSAGE');--> statement-breakpoint
CREATE TYPE "public"."rsvp_status" AS ENUM('YES', 'NO', 'MAYBE', 'WAITLIST');--> statement-breakpoint
CREATE TYPE "public"."scheduled_role_action_status" AS ENUM('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."welcome_avatar_shape" AS ENUM('CIRCLE', 'SQUARE', 'ROUNDED');--> statement-breakpoint
CREATE TYPE "public"."welcome_background_type" AS ENUM('COLOR', 'GRADIENT', 'IMAGE');--> statement-breakpoint
CREATE TYPE "public"."welcome_image_position" AS ENUM('ABOVE', 'BELOW', 'ONLY');--> statement-breakpoint
CREATE TYPE "public"."welcome_target_type" AS ENUM('CHANNEL', 'DM');--> statement-breakpoint
CREATE TABLE "action_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"action_type" text NOT NULL,
	"target_user_id" text NOT NULL,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"success" boolean NOT NULL,
	"error_message" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "api_key" (
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "birthday_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"channel_id" text,
	"role_id" text,
	"message_template" text DEFAULT '🎉 Happy Birthday {user.mention}! 🎂' NOT NULL,
	"message_embed" jsonb,
	"hour_of_day" integer DEFAULT 9 NOT NULL,
	"show_age" boolean DEFAULT true NOT NULL,
	"mention_role_id" text,
	"auto_remove_role" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "birthday_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"month" integer NOT NULL,
	"day" integer NOT NULL,
	"year" integer,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"last_celebrated_year" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "birthday_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"celebrated_at" timestamp with time zone NOT NULL,
	"message_sent" boolean DEFAULT false NOT NULL,
	"role_assigned" boolean DEFAULT false NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "command_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"command_id" text NOT NULL,
	"enabled_roles" text[],
	"disabled_roles" text[],
	"enabled_channels" text[],
	"disabled_channels" text[],
	"roles_can_skip_max_limit" text[],
	"max_limit" integer,
	"auto_delete_invocation" boolean DEFAULT false NOT NULL,
	"auto_delete_reply_after_seconds" integer,
	"auto_delete_with_invocation_deletion" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_rbac_config" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"default_access" "rbac_default_access" DEFAULT 'manage_guild_only' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_rbac_rules" (
	"guild_id" text NOT NULL,
	"module_id" text NOT NULL,
	"allowed_view_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allowed_edit_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "dashboard_rbac_rules_guild_id_module_id_pk" PRIMARY KEY("guild_id","module_id")
);
--> statement-breakpoint
CREATE TABLE "discord_user_cache" (
	"user_id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"global_name" text,
	"avatar" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event" (
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
	"status" "event_status" DEFAULT 'SCHEDULED' NOT NULL,
	"max_attendees" integer,
	"enable_waitlist" boolean DEFAULT false NOT NULL,
	"close_rsvp_before_start_minutes" integer,
	"mention_role_ids" text[],
	"mention_on_create" boolean DEFAULT false NOT NULL,
	"mention_on_start" boolean DEFAULT false NOT NULL,
	"required_role_ids" text[],
	"blocked_role_ids" text[],
	"attendee_role_id" text,
	"repeat_frequency" "repeat_frequency" DEFAULT 'NONE' NOT NULL,
	"repeat_until" timestamp with time zone,
	"parent_event_id" uuid,
	"mirror_to_discord" boolean DEFAULT true NOT NULL,
	"discord_scheduled_event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_poll_settings" (
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_reminder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"minutes_before" integer NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_rsvp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" "rsvp_status" DEFAULT 'YES' NOT NULL,
	"responded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_template" (
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guild_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"welcome_enabled" boolean DEFAULT false NOT NULL,
	"auto_role_id" text,
	"join_message_channel_id" text,
	"join_message" text,
	"join_message_embed" jsonb,
	"leave_message_channel_id" text,
	"leave_message" text,
	"leave_message_embed" jsonb,
	"verification_enabled" boolean DEFAULT false NOT NULL,
	"unverified_role_id" text,
	"verification_role_id" text,
	"verification_grace_days" integer DEFAULT 30 NOT NULL,
	"verification_kick_dm_enabled" boolean DEFAULT true NOT NULL,
	"verification_message" text,
	"verification_message_channel_id" text,
	"verification_welcome_message" text,
	"verification_message_embed" jsonb,
	"last_member_sync" timestamp with time zone,
	"boost_enabled" boolean DEFAULT false NOT NULL,
	"boost_announcement_channel_id" text,
	"boost_role_id" text,
	"boost_role_name" text,
	"boost_role_color_primary" text,
	"boost_role_color_secondary" text,
	"boost_claim_required" boolean DEFAULT true NOT NULL,
	"boost_welcome_message" text,
	"boost_welcome_message_embed" jsonb,
	"boost_re_boost_message" text,
	"boost_re_boost_message_embed" jsonb,
	"boost_role_removal_days" integer DEFAULT 30 NOT NULL,
	"boost_role_removal_dm_enabled" boolean DEFAULT true NOT NULL,
	"leveling_enabled" boolean DEFAULT false NOT NULL,
	"text_xp_min" integer DEFAULT 15 NOT NULL,
	"text_xp_max" integer DEFAULT 25 NOT NULL,
	"text_xp_cooldown" integer DEFAULT 60 NOT NULL,
	"voice_xp_per_minute" integer DEFAULT 10 NOT NULL,
	"level_up_notif_enabled" boolean DEFAULT true NOT NULL,
	"level_up_channel_id" text,
	"level_up_message" text,
	"level_up_message_embed" jsonb,
	"dashboard_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guild_config_guild_id_unique" UNIQUE("guild_id")
);
--> statement-breakpoint
CREATE TABLE "guild_growth" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"member_count" integer NOT NULL,
	"verified_count" integer DEFAULT 0 NOT NULL,
	"joined_today" integer DEFAULT 0 NOT NULL,
	"left_today" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "level_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"text_xp" integer DEFAULT 0 NOT NULL,
	"voice_xp" integer DEFAULT 0 NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"last_text_xp_at" timestamp with time zone,
	"voice_joined_at" timestamp with time zone,
	"total_voice_minutes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "level_reward" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"role_id" text NOT NULL,
	"level" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_watchlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"added_by" text NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"severity" text DEFAULT 'LOW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"hour" integer NOT NULL,
	"day" integer NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_alias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"trigger" text NOT NULL,
	"response" text NOT NULL,
	"response_embed" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"case_sensitive" boolean DEFAULT false NOT NULL,
	"delete_trigger" boolean DEFAULT false NOT NULL,
	"require_prefix" text DEFAULT '!',
	"allowed_channels" text[],
	"allowed_roles" text[],
	"cooldown_seconds" integer DEFAULT 5 NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"embed_enabled" boolean DEFAULT false NOT NULL,
	"embed_title" text,
	"embed_description" text,
	"embed_color" text,
	"embed_thumbnail" boolean DEFAULT false NOT NULL,
	"embed_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_case" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"case_number" integer NOT NULL,
	"user_id" text NOT NULL,
	"moderator_id" text NOT NULL,
	"action" text NOT NULL,
	"reason" text,
	"duration" integer,
	"expires_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"auto_mod_enabled" boolean DEFAULT false NOT NULL,
	"spam_threshold" integer DEFAULT 5,
	"spam_action" text DEFAULT 'WARN',
	"spam_mute_duration" integer DEFAULT 10,
	"word_filter_enabled" boolean DEFAULT false NOT NULL,
	"word_filter_list" text,
	"word_filter_action" text DEFAULT 'DELETE',
	"invite_filter_enabled" boolean DEFAULT false NOT NULL,
	"invite_filter_action" text DEFAULT 'DELETE',
	"log_channel_id" text,
	"mute_role_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"module_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "poll" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"message_id" text,
	"channel_id" text NOT NULL,
	"question" text NOT NULL,
	"description" text,
	"color" text,
	"type" "poll_type" DEFAULT 'STANDARD' NOT NULL,
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_option" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"text" text NOT NULL,
	"emoji" text,
	"date_time_value" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"question" text,
	"poll_description" text,
	"type" "poll_type" DEFAULT 'STANDARD' NOT NULL,
	"allow_multiple_votes" boolean DEFAULT false NOT NULL,
	"max_votes_per_user" integer,
	"allow_custom_options" boolean DEFAULT false NOT NULL,
	"default_options" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_vote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"voted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"role_id" text NOT NULL,
	"action_group" text,
	"trigger_type" "role_action_trigger" DEFAULT 'ADD' NOT NULL,
	"action_type" "role_action_type" NOT NULL,
	"action_delay" integer DEFAULT 0 NOT NULL,
	"dm_message" text,
	"dm_message_embed" jsonb,
	"channel_id" text,
	"kick_reason" text,
	"log_channel_id" text,
	"required_role_ids" text[] DEFAULT '{}' NOT NULL,
	"required_role_logic" "role_action_required_logic" DEFAULT 'AND' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_role_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"action_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"execute_at" timestamp with time zone NOT NULL,
	"status" "scheduled_role_action_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_boost" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"boosted_at" timestamp with time zone NOT NULL,
	"boost_ends_at" timestamp with time zone NOT NULL,
	"role_assigned" boolean DEFAULT false NOT NULL,
	"role_removed" boolean DEFAULT false NOT NULL,
	"role_removed_at" timestamp with time zone,
	"notified_before_removal" boolean DEFAULT false NOT NULL,
	"boost_count_total" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_join" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_bot" boolean DEFAULT false NOT NULL,
	"kicked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_timezone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"detected_automatically" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_timezone_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "verification_message_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"name" text,
	"role_id" text NOT NULL,
	"notify_channel_id" text,
	"message" text,
	"message_embed" jsonb,
	"welcome_message" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_role_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"role_id" text NOT NULL,
	"notify_channel_id" text,
	"message" text,
	"message_embed" jsonb,
	"welcome_message" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_delivery" (
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoint" (
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "welcome_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"target_type" "welcome_target_type" DEFAULT 'CHANNEL' NOT NULL,
	"channel_id" text,
	"message_template" text,
	"embed_enabled" boolean DEFAULT false NOT NULL,
	"embed_config" jsonb,
	"welcome_bots_enabled" boolean DEFAULT false NOT NULL,
	"goodbye_enabled" boolean DEFAULT false NOT NULL,
	"goodbye_channel_id" text,
	"goodbye_message_template" text,
	"goodbye_embed_enabled" boolean DEFAULT false NOT NULL,
	"goodbye_embed_config" jsonb,
	"goodbye_bots_enabled" boolean DEFAULT false NOT NULL,
	"goodbye_image_enabled" boolean DEFAULT false NOT NULL,
	"private_enabled" boolean DEFAULT false NOT NULL,
	"private_message_template" text,
	"private_embed_enabled" boolean DEFAULT false NOT NULL,
	"private_embed_config" jsonb,
	"private_image_enabled" boolean DEFAULT false NOT NULL,
	"image_enabled" boolean DEFAULT false NOT NULL,
	"image_send_mode" text DEFAULT 'WITH_TEXT',
	"image_channel_id" text,
	"canvas_width" integer DEFAULT 1024,
	"canvas_height" integer DEFAULT 500,
	"background_type" "welcome_background_type" DEFAULT 'COLOR' NOT NULL,
	"background_value" text DEFAULT '#36393f',
	"overlay_opacity" integer DEFAULT 50,
	"avatar_shape" "welcome_avatar_shape" DEFAULT 'CIRCLE' NOT NULL,
	"avatar_x" integer DEFAULT 150,
	"avatar_y" integer DEFAULT 150,
	"avatar_size" integer DEFAULT 128,
	"avatar_border_color" text DEFAULT '#ffffff',
	"avatar_border_width" integer DEFAULT 4,
	"username_x" integer DEFAULT 300,
	"username_y" integer DEFAULT 130,
	"username_font" text DEFAULT 'Arial',
	"username_size" integer DEFAULT 32,
	"username_color" text DEFAULT '#ffffff',
	"username_align" text DEFAULT 'left',
	"subtitle_enabled" boolean DEFAULT true NOT NULL,
	"subtitle_template" text DEFAULT 'Welcome to [server]!',
	"subtitle_x" integer DEFAULT 300,
	"subtitle_y" integer DEFAULT 180,
	"subtitle_font" text DEFAULT 'Arial',
	"subtitle_size" integer DEFAULT 24,
	"subtitle_color" text DEFAULT '#cccccc',
	"show_server_name" boolean DEFAULT false NOT NULL,
	"server_name_x" integer DEFAULT 300,
	"server_name_y" integer DEFAULT 80,
	"server_name_font" text DEFAULT 'Arial',
	"server_name_size" integer DEFAULT 28,
	"server_name_color" text DEFAULT '#ffffff',
	"cooldown_enabled" boolean DEFAULT false NOT NULL,
	"cooldown_seconds" integer DEFAULT 5,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "welcome_trigger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"role_id" text NOT NULL,
	"channel_id" text,
	"template_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_log" ADD CONSTRAINT "action_log_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_config" ADD CONSTRAINT "birthday_config_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_entry" ADD CONSTRAINT "birthday_entry_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_log" ADD CONSTRAINT "birthday_log_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_config" ADD CONSTRAINT "command_config_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_rbac_rules" ADD CONSTRAINT "dashboard_rbac_rules_guild_id_dashboard_rbac_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."dashboard_rbac_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_poll_settings" ADD CONSTRAINT "event_poll_settings_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_reminder" ADD CONSTRAINT "event_reminder_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_rsvp" ADD CONSTRAINT "event_rsvp_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_template" ADD CONSTRAINT "event_template_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_growth" ADD CONSTRAINT "guild_growth_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_profile" ADD CONSTRAINT "level_profile_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_reward" ADD CONSTRAINT "level_reward_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_watchlist" ADD CONSTRAINT "member_watchlist_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_activity" ADD CONSTRAINT "message_activity_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_alias" ADD CONSTRAINT "message_alias_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_case" ADD CONSTRAINT "moderation_case_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_settings" ADD CONSTRAINT "moderation_settings_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_state" ADD CONSTRAINT "module_state_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_notification_id_notification_event_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notification_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_event" ADD CONSTRAINT "notification_event_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_user_cursor" ADD CONSTRAINT "notification_user_cursor_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_user_state" ADD CONSTRAINT "notification_user_state_notification_id_notification_event_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notification_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll" ADD CONSTRAINT "poll_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_option" ADD CONSTRAINT "poll_option_poll_id_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."poll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_template" ADD CONSTRAINT "poll_template_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_poll_id_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."poll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_option_id_poll_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_action" ADD CONSTRAINT "role_action_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_role_action" ADD CONSTRAINT "scheduled_role_action_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_role_action" ADD CONSTRAINT "scheduled_role_action_action_id_role_action_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."role_action"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_boost" ADD CONSTRAINT "user_boost_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_join" ADD CONSTRAINT "user_join_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_message_rule" ADD CONSTRAINT "verification_message_rule_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_role_message" ADD CONSTRAINT "verification_role_message_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery" ADD CONSTRAINT "webhook_delivery_webhook_id_webhook_endpoint_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhook_endpoint"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoint" ADD CONSTRAINT "webhook_endpoint_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "welcome_config" ADD CONSTRAINT "welcome_config_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "welcome_trigger" ADD CONSTRAINT "welcome_trigger_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "welcome_trigger" ADD CONSTRAINT "welcome_trigger_template_id_message_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."message_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_log_guild_type_idx" ON "action_log" USING btree ("guild_id","action_type");--> statement-breakpoint
CREATE INDEX "action_log_guild_executed_idx" ON "action_log" USING btree ("guild_id","executed_at");--> statement-breakpoint
CREATE INDEX "action_log_guild_type_executed_idx" ON "action_log" USING btree ("guild_id","action_type","executed_at");--> statement-breakpoint
CREATE INDEX "api_key_guild_id_idx" ON "api_key" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "api_key_key_hash_idx" ON "api_key" USING btree ("key_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "birthday_config_guild_id_unique" ON "birthday_config" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "birthday_config_guild_id_idx" ON "birthday_config" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "birthday_entry_guild_user_unique" ON "birthday_entry" USING btree ("guild_id","user_id");--> statement-breakpoint
CREATE INDEX "birthday_entry_guild_month_day_idx" ON "birthday_entry" USING btree ("guild_id","month","day");--> statement-breakpoint
CREATE INDEX "birthday_entry_guild_id_idx" ON "birthday_entry" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "birthday_log_guild_user_idx" ON "birthday_log" USING btree ("guild_id","user_id");--> statement-breakpoint
CREATE INDEX "birthday_log_guild_celebrated_idx" ON "birthday_log" USING btree ("guild_id","celebrated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "command_config_guild_command_unique" ON "command_config" USING btree ("guild_id","command_id");--> statement-breakpoint
CREATE INDEX "command_config_guild_id_idx" ON "command_config" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "dashboard_rbac_rules_guild_id_idx" ON "dashboard_rbac_rules" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "discord_user_cache_updated_idx" ON "discord_user_cache" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "event_guild_id_idx" ON "event" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "event_guild_start_time_idx" ON "event" USING btree ("guild_id","start_time");--> statement-breakpoint
CREATE INDEX "event_guild_status_idx" ON "event" USING btree ("guild_id","status");--> statement-breakpoint
CREATE INDEX "event_start_time_idx" ON "event" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "event_status_start_time_idx" ON "event" USING btree ("status","start_time");--> statement-breakpoint
CREATE UNIQUE INDEX "event_poll_settings_guild_unique" ON "event_poll_settings" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_reminder_event_user_minutes_unique" ON "event_reminder" USING btree ("event_id","user_id","minutes_before");--> statement-breakpoint
CREATE INDEX "event_reminder_event_id_idx" ON "event_reminder" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_reminder_user_id_idx" ON "event_reminder" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "event_reminder_sent_at_idx" ON "event_reminder" USING btree ("sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "event_rsvp_event_user_unique" ON "event_rsvp" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "event_rsvp_event_id_idx" ON "event_rsvp" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_rsvp_user_id_idx" ON "event_rsvp" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "event_rsvp_status_idx" ON "event_rsvp" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "event_template_guild_name_unique" ON "event_template" USING btree ("guild_id","name");--> statement-breakpoint
CREATE INDEX "event_template_guild_id_idx" ON "event_template" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guild_growth_guild_date_unique" ON "guild_growth" USING btree ("guild_id","date");--> statement-breakpoint
CREATE INDEX "guild_growth_guild_id_idx" ON "guild_growth" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "level_profile_guild_user_unique" ON "level_profile" USING btree ("guild_id","user_id");--> statement-breakpoint
CREATE INDEX "level_profile_guild_xp_idx" ON "level_profile" USING btree ("guild_id","total_xp");--> statement-breakpoint
CREATE INDEX "level_profile_guild_level_idx" ON "level_profile" USING btree ("guild_id","level");--> statement-breakpoint
CREATE UNIQUE INDEX "level_reward_guild_level_role_unique" ON "level_reward" USING btree ("guild_id","level","role_id");--> statement-breakpoint
CREATE INDEX "level_reward_guild_id_idx" ON "level_reward" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_watchlist_guild_user_unique" ON "member_watchlist" USING btree ("guild_id","user_id");--> statement-breakpoint
CREATE INDEX "member_watchlist_guild_id_idx" ON "member_watchlist" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "member_watchlist_user_id_idx" ON "member_watchlist" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_activity_guild_hour_day_date" ON "message_activity" USING btree ("guild_id","date","hour");--> statement-breakpoint
CREATE INDEX "message_activity_guild_id_idx" ON "message_activity" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "message_activity_guild_date_hour_idx" ON "message_activity" USING btree ("guild_id","date","hour");--> statement-breakpoint
CREATE UNIQUE INDEX "message_alias_guild_trigger_unique" ON "message_alias" USING btree ("guild_id","trigger");--> statement-breakpoint
CREATE INDEX "message_alias_guild_id_idx" ON "message_alias" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "message_alias_guild_enabled_idx" ON "message_alias" USING btree ("guild_id","enabled");--> statement-breakpoint
CREATE INDEX "message_template_guild_id_idx" ON "message_template" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_case_guild_case_unique" ON "moderation_case" USING btree ("guild_id","case_number");--> statement-breakpoint
CREATE INDEX "moderation_case_guild_user_idx" ON "moderation_case" USING btree ("guild_id","user_id");--> statement-breakpoint
CREATE INDEX "moderation_case_guild_moderator_idx" ON "moderation_case" USING btree ("guild_id","moderator_id");--> statement-breakpoint
CREATE INDEX "moderation_case_guild_action_idx" ON "moderation_case" USING btree ("guild_id","action");--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_settings_guild_unique" ON "moderation_settings" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "module_state_guild_module_unique" ON "module_state" USING btree ("guild_id","module_id");--> statement-breakpoint
CREATE INDEX "module_state_guild_id_idx" ON "module_state" USING btree ("guild_id");--> statement-breakpoint
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
CREATE INDEX "notification_user_state_user_archived_idx" ON "notification_user_state" USING btree ("user_id","archived_at");--> statement-breakpoint
CREATE INDEX "poll_guild_id_idx" ON "poll" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "poll_guild_closed_idx" ON "poll" USING btree ("guild_id","closed");--> statement-breakpoint
CREATE INDEX "poll_end_time_idx" ON "poll" USING btree ("end_time");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_option_poll_order_unique" ON "poll_option" USING btree ("poll_id","order");--> statement-breakpoint
CREATE INDEX "poll_option_poll_id_idx" ON "poll_option" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "poll_template_guild_id_idx" ON "poll_template" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_vote_poll_user_option_unique" ON "poll_vote" USING btree ("poll_id","user_id","option_id");--> statement-breakpoint
CREATE INDEX "poll_vote_poll_id_idx" ON "poll_vote" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "poll_vote_option_id_idx" ON "poll_vote" USING btree ("option_id");--> statement-breakpoint
CREATE INDEX "poll_vote_user_id_idx" ON "poll_vote" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "role_action_guild_role_idx" ON "role_action" USING btree ("guild_id","role_id");--> statement-breakpoint
CREATE INDEX "scheduled_role_action_status_execute_idx" ON "scheduled_role_action" USING btree ("status","execute_at");--> statement-breakpoint
CREATE INDEX "scheduled_role_action_guild_status_execute_idx" ON "scheduled_role_action" USING btree ("guild_id","status","execute_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_boost_guild_user_unique" ON "user_boost" USING btree ("guild_id","user_id");--> statement-breakpoint
CREATE INDEX "user_boost_guild_ends_idx" ON "user_boost" USING btree ("guild_id","boost_ends_at");--> statement-breakpoint
CREATE INDEX "user_boost_guild_removed_idx" ON "user_boost" USING btree ("guild_id","role_removed");--> statement-breakpoint
CREATE INDEX "user_boost_guild_removed_boosted_idx" ON "user_boost" USING btree ("guild_id","role_removed","boosted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_join_guild_user_unique" ON "user_join" USING btree ("guild_id","user_id");--> statement-breakpoint
CREATE INDEX "user_join_guild_verified_idx" ON "user_join" USING btree ("guild_id","is_verified");--> statement-breakpoint
CREATE INDEX "user_join_guild_joined_idx" ON "user_join" USING btree ("guild_id","joined_at");--> statement-breakpoint
CREATE INDEX "user_timezone_user_id_idx" ON "user_timezone" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_message_rule_guild_role_unique" ON "verification_message_rule" USING btree ("guild_id","role_id");--> statement-breakpoint
CREATE INDEX "verification_message_rule_guild_id_idx" ON "verification_message_rule" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_role_message_guild_role_unique" ON "verification_role_message" USING btree ("guild_id","role_id");--> statement-breakpoint
CREATE INDEX "verification_role_message_guild_id_idx" ON "verification_role_message" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "webhook_delivery_webhook_id_idx" ON "webhook_delivery" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "webhook_delivery_created_at_idx" ON "webhook_delivery" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "webhook_endpoint_guild_id_idx" ON "webhook_endpoint" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "webhook_endpoint_guild_enabled_idx" ON "webhook_endpoint" USING btree ("guild_id","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "welcome_config_guild_id_unique" ON "welcome_config" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "welcome_config_guild_id_idx" ON "welcome_config" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "welcome_trigger_guild_id_idx" ON "welcome_trigger" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "welcome_trigger_guild_role_unique" ON "welcome_trigger" USING btree ("guild_id","role_id");