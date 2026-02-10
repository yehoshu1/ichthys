CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint
CREATE TYPE "public"."reaction_role_type" AS ENUM('TOGGLE', 'ADD_ONLY', 'REMOVE_ONLY', 'UNIQUE');--> statement-breakpoint
CREATE TYPE "public"."role_action_trigger" AS ENUM('ADD', 'REMOVE');--> statement-breakpoint
CREATE TYPE "public"."role_action_type" AS ENUM('DM', 'KICK', 'LOG', 'MSG', 'MESSAGE');--> statement-breakpoint
CREATE TYPE "public"."scheduled_role_action_status" AS ENUM('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'CANCELLED');--> statement-breakpoint
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
CREATE TABLE "discord_user_cache" (
	"user_id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"global_name" text,
	"avatar" text,
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
CREATE TABLE "reaction_role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"reaction_role_message_id" uuid,
	"message_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"emoji" text NOT NULL,
	"role_id" text NOT NULL,
	"type" "reaction_role_type" DEFAULT 'TOGGLE' NOT NULL,
	"exclusive_role_ids" text[],
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reaction_role_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"message_id" text,
	"channel_id" text NOT NULL,
	"title" text,
	"content" text,
	"embed" jsonb,
	"color" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "verification_message_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"name" text,
	"role_id" text NOT NULL,
	"notify_channel_id" text,
	"message" text NOT NULL,
	"message_embed" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_role_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"role_id" text NOT NULL,
	"message" text NOT NULL,
	"message_embed" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
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
ALTER TABLE "birthday_config" ADD CONSTRAINT "birthday_config_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_entry" ADD CONSTRAINT "birthday_entry_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_log" ADD CONSTRAINT "birthday_log_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_config" ADD CONSTRAINT "command_config_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_growth" ADD CONSTRAINT "guild_growth_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_profile" ADD CONSTRAINT "level_profile_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_reward" ADD CONSTRAINT "level_reward_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_activity" ADD CONSTRAINT "message_activity_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_alias" ADD CONSTRAINT "message_alias_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_case" ADD CONSTRAINT "moderation_case_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_settings" ADD CONSTRAINT "moderation_settings_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reaction_role" ADD CONSTRAINT "reaction_role_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reaction_role" ADD CONSTRAINT "reaction_role_reaction_role_message_id_reaction_role_message_id_fk" FOREIGN KEY ("reaction_role_message_id") REFERENCES "public"."reaction_role_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reaction_role_message" ADD CONSTRAINT "reaction_role_message_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_action" ADD CONSTRAINT "role_action_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_role_action" ADD CONSTRAINT "scheduled_role_action_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_role_action" ADD CONSTRAINT "scheduled_role_action_action_id_role_action_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."role_action"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_boost" ADD CONSTRAINT "user_boost_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_join" ADD CONSTRAINT "user_join_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_message_rule" ADD CONSTRAINT "verification_message_rule_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_role_message" ADD CONSTRAINT "verification_role_message_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "welcome_trigger" ADD CONSTRAINT "welcome_trigger_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "welcome_trigger" ADD CONSTRAINT "welcome_trigger_template_id_message_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."message_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_log_guild_type_idx" ON "action_log" USING btree ("guild_id","action_type");--> statement-breakpoint
CREATE INDEX "action_log_guild_executed_idx" ON "action_log" USING btree ("guild_id","executed_at");--> statement-breakpoint
CREATE INDEX "action_log_guild_type_executed_idx" ON "action_log" USING btree ("guild_id","action_type","executed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "birthday_config_guild_id_unique" ON "birthday_config" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "birthday_config_guild_id_idx" ON "birthday_config" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "birthday_entry_guild_user_unique" ON "birthday_entry" USING btree ("guild_id","user_id");--> statement-breakpoint
CREATE INDEX "birthday_entry_guild_month_day_idx" ON "birthday_entry" USING btree ("guild_id","month","day");--> statement-breakpoint
CREATE INDEX "birthday_entry_guild_id_idx" ON "birthday_entry" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "birthday_log_guild_user_idx" ON "birthday_log" USING btree ("guild_id","user_id");--> statement-breakpoint
CREATE INDEX "birthday_log_guild_celebrated_idx" ON "birthday_log" USING btree ("guild_id","celebrated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "command_config_guild_command_unique" ON "command_config" USING btree ("guild_id","command_id");--> statement-breakpoint
CREATE INDEX "command_config_guild_id_idx" ON "command_config" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "discord_user_cache_updated_idx" ON "discord_user_cache" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "guild_growth_guild_date_unique" ON "guild_growth" USING btree ("guild_id","date");--> statement-breakpoint
CREATE INDEX "guild_growth_guild_id_idx" ON "guild_growth" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "level_profile_guild_user_unique" ON "level_profile" USING btree ("guild_id","user_id");--> statement-breakpoint
CREATE INDEX "level_profile_guild_xp_idx" ON "level_profile" USING btree ("guild_id","total_xp");--> statement-breakpoint
CREATE INDEX "level_profile_guild_level_idx" ON "level_profile" USING btree ("guild_id","level");--> statement-breakpoint
CREATE UNIQUE INDEX "level_reward_guild_level_role_unique" ON "level_reward" USING btree ("guild_id","level","role_id");--> statement-breakpoint
CREATE INDEX "level_reward_guild_id_idx" ON "level_reward" USING btree ("guild_id");--> statement-breakpoint
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
CREATE INDEX "reaction_role_guild_message_idx" ON "reaction_role" USING btree ("guild_id","message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reaction_role_message_emoji_unique" ON "reaction_role" USING btree ("message_id","emoji");--> statement-breakpoint
CREATE INDEX "reaction_role_guild_id_idx" ON "reaction_role" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "reaction_role_reaction_role_message_idx" ON "reaction_role" USING btree ("reaction_role_message_id");--> statement-breakpoint
CREATE INDEX "reaction_role_message_guild_id_idx" ON "reaction_role_message" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "reaction_role_message_message_id_idx" ON "reaction_role_message" USING btree ("message_id");--> statement-breakpoint
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
CREATE UNIQUE INDEX "verification_message_rule_guild_role_unique" ON "verification_message_rule" USING btree ("guild_id","role_id");--> statement-breakpoint
CREATE INDEX "verification_message_rule_guild_id_idx" ON "verification_message_rule" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_role_message_guild_role_unique" ON "verification_role_message" USING btree ("guild_id","role_id");--> statement-breakpoint
CREATE INDEX "verification_role_message_guild_id_idx" ON "verification_role_message" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "welcome_trigger_guild_id_idx" ON "welcome_trigger" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "welcome_trigger_guild_role_unique" ON "welcome_trigger" USING btree ("guild_id","role_id");--> statement-breakpoint
CREATE INDEX "scheduled_role_action_pending_execute_idx"
ON "scheduled_role_action" USING btree ("execute_at")
WHERE "status" = 'PENDING';
