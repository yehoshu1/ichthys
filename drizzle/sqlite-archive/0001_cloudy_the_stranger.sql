CREATE TABLE `command_config` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`command_id` text NOT NULL,
	`enabled_roles` text,
	`disabled_roles` text,
	`enabled_channels` text,
	`disabled_channels` text,
	`roles_can_skip_max_limit` text,
	`max_limit` integer,
	`auto_delete_invocation` integer DEFAULT false NOT NULL,
	`auto_delete_reply_after_seconds` integer,
	`auto_delete_with_invocation_deletion` integer DEFAULT false NOT NULL,
	`aliases` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guild_config`(`guild_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `command_config_guild_command_unique` ON `command_config` (`guild_id`,`command_id`);
--> statement-breakpoint
CREATE INDEX `command_config_guild_id_idx` ON `command_config` (`guild_id`);
