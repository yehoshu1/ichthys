CREATE TABLE `action_log` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`action_type` text NOT NULL,
	`target_user_id` text NOT NULL,
	`executed_at` integer NOT NULL,
	`success` integer NOT NULL,
	`error_message` text,
	`metadata` text,
	FOREIGN KEY (`guild_id`) REFERENCES `guild_config`(`guild_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `action_log_guild_type_idx` ON `action_log` (`guild_id`,`action_type`);--> statement-breakpoint
CREATE INDEX `action_log_guild_executed_idx` ON `action_log` (`guild_id`,`executed_at`);--> statement-breakpoint
CREATE INDEX `action_log_guild_type_executed_idx` ON `action_log` (`guild_id`,`action_type`,`executed_at`);--> statement-breakpoint
CREATE TABLE `discord_user_cache` (
	`user_id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`global_name` text,
	`avatar` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `discord_user_cache_updated_idx` ON `discord_user_cache` (`updated_at`);--> statement-breakpoint
CREATE TABLE `guild_config` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`welcome_enabled` integer DEFAULT false NOT NULL,
	`auto_role_id` text,
	`join_message_channel_id` text,
	`join_message` text,
	`join_message_embed` text,
	`leave_message_channel_id` text,
	`leave_message` text,
	`leave_message_embed` text,
	`verification_enabled` integer DEFAULT false NOT NULL,
	`unverified_role_id` text,
	`verification_role_id` text,
	`verification_grace_days` integer DEFAULT 30 NOT NULL,
	`verification_kick_dm_enabled` integer DEFAULT true NOT NULL,
	`verification_message` text,
	`verification_message_embed` text,
	`last_member_sync` integer,
	`boost_enabled` integer DEFAULT false NOT NULL,
	`boost_announcement_channel_id` text,
	`boost_role_id` text,
	`boost_role_name` text,
	`boost_role_color_primary` text,
	`boost_role_color_secondary` text,
	`boost_claim_required` integer DEFAULT true NOT NULL,
	`boost_welcome_message` text,
	`boost_welcome_message_embed` text,
	`boost_re_boost_message` text,
	`boost_re_boost_message_embed` text,
	`boost_role_removal_days` integer DEFAULT 30 NOT NULL,
	`boost_role_removal_dm_enabled` integer DEFAULT true NOT NULL,
	`leveling_enabled` integer DEFAULT false NOT NULL,
	`text_xp_min` integer DEFAULT 15 NOT NULL,
	`text_xp_max` integer DEFAULT 25 NOT NULL,
	`text_xp_cooldown` integer DEFAULT 60 NOT NULL,
	`voice_xp_per_minute` integer DEFAULT 10 NOT NULL,
	`level_up_notif_enabled` integer DEFAULT true NOT NULL,
	`level_up_channel_id` text,
	`level_up_message` text,
	`level_up_message_embed` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guild_config_guild_id_unique` ON `guild_config` (`guild_id`);--> statement-breakpoint
CREATE TABLE `level_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`text_xp` integer DEFAULT 0 NOT NULL,
	`voice_xp` integer DEFAULT 0 NOT NULL,
	`total_xp` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 0 NOT NULL,
	`last_text_xp_at` integer,
	`voice_joined_at` integer,
	`total_voice_minutes` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guild_config`(`guild_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `level_profile_guild_user_unique` ON `level_profile` (`guild_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `level_profile_guild_xp_idx` ON `level_profile` (`guild_id`,`total_xp`);--> statement-breakpoint
CREATE INDEX `level_profile_guild_level_idx` ON `level_profile` (`guild_id`,`level`);--> statement-breakpoint
CREATE TABLE `level_reward` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`role_id` text NOT NULL,
	`level` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guild_config`(`guild_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `level_reward_guild_level_role_unique` ON `level_reward` (`guild_id`,`level`,`role_id`);--> statement-breakpoint
CREATE INDEX `level_reward_guild_id_idx` ON `level_reward` (`guild_id`);--> statement-breakpoint
CREATE TABLE `message_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`hour` integer NOT NULL,
	`day` integer NOT NULL,
	`date` integer NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guild_config`(`guild_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_activity_guild_hour_day_date` ON `message_activity` (`guild_id`,`date`,`hour`);--> statement-breakpoint
CREATE INDEX `message_activity_guild_id_idx` ON `message_activity` (`guild_id`);--> statement-breakpoint
CREATE INDEX `message_activity_guild_date_hour_idx` ON `message_activity` (`guild_id`,`date`,`hour`);--> statement-breakpoint
CREATE TABLE `message_template` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`embed_enabled` integer DEFAULT false NOT NULL,
	`embed_title` text,
	`embed_description` text,
	`embed_color` text,
	`embed_thumbnail` integer DEFAULT false NOT NULL,
	`embed_data` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `message_template_guild_id_idx` ON `message_template` (`guild_id`);--> statement-breakpoint
CREATE TABLE `role_action` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`role_id` text NOT NULL,
	`action_group` text,
	`trigger_type` text DEFAULT 'ADD' NOT NULL,
	`action_type` text NOT NULL,
	`action_delay` integer DEFAULT 0 NOT NULL,
	`dm_message` text,
	`dm_message_embed` text,
	`channel_id` text,
	`kick_reason` text,
	`log_channel_id` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guild_config`(`guild_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `role_action_guild_role_idx` ON `role_action` (`guild_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `scheduled_role_action` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`action_id` text NOT NULL,
	`user_id` text NOT NULL,
	`execute_at` integer NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guild_config`(`guild_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`action_id`) REFERENCES `role_action`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scheduled_role_action_status_execute_idx` ON `scheduled_role_action` (`status`,`execute_at`);--> statement-breakpoint
CREATE INDEX `scheduled_role_action_guild_status_execute_idx` ON `scheduled_role_action` (`guild_id`,`status`,`execute_at`);--> statement-breakpoint
CREATE TABLE `user_boost` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`boosted_at` integer NOT NULL,
	`boost_ends_at` integer NOT NULL,
	`role_assigned` integer DEFAULT false NOT NULL,
	`role_removed` integer DEFAULT false NOT NULL,
	`role_removed_at` integer,
	`notified_before_removal` integer DEFAULT false NOT NULL,
	`boost_count_total` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guild_config`(`guild_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_boost_guild_user_unique` ON `user_boost` (`guild_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `user_boost_guild_ends_idx` ON `user_boost` (`guild_id`,`boost_ends_at`);--> statement-breakpoint
CREATE INDEX `user_boost_guild_removed_idx` ON `user_boost` (`guild_id`,`role_removed`);--> statement-breakpoint
CREATE INDEX `user_boost_guild_removed_boosted_idx` ON `user_boost` (`guild_id`,`role_removed`,`boosted_at`);--> statement-breakpoint
CREATE TABLE `user_join` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	`verified_at` integer,
	`is_verified` integer DEFAULT false NOT NULL,
	`is_bot` integer DEFAULT false NOT NULL,
	`kicked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guild_config`(`guild_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_join_guild_user_unique` ON `user_join` (`guild_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `user_join_guild_verified_idx` ON `user_join` (`guild_id`,`is_verified`);--> statement-breakpoint
CREATE INDEX `user_join_guild_joined_idx` ON `user_join` (`guild_id`,`joined_at`);--> statement-breakpoint
CREATE TABLE `verification_message_rule` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`name` text,
	`role_id` text NOT NULL,
	`notify_channel_id` text,
	`message` text NOT NULL,
	`message_embed` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guild_config`(`guild_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `verification_message_rule_guild_role_unique` ON `verification_message_rule` (`guild_id`,`role_id`);--> statement-breakpoint
CREATE INDEX `verification_message_rule_guild_id_idx` ON `verification_message_rule` (`guild_id`);--> statement-breakpoint
CREATE TABLE `verification_role_message` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`role_id` text NOT NULL,
	`message` text NOT NULL,
	`message_embed` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guild_config`(`guild_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `verification_role_message_guild_role_unique` ON `verification_role_message` (`guild_id`,`role_id`);--> statement-breakpoint
CREATE INDEX `verification_role_message_guild_id_idx` ON `verification_role_message` (`guild_id`);--> statement-breakpoint
CREATE TABLE `welcome_trigger` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`role_id` text NOT NULL,
	`channel_id` text,
	`template_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guild_config`(`guild_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `message_template`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `welcome_trigger_guild_id_idx` ON `welcome_trigger` (`guild_id`);--> statement-breakpoint
CREATE INDEX `welcome_trigger_guild_role_unique` ON `welcome_trigger` (`guild_id`,`role_id`);