-- Add verification message channel and welcome message to guild_config
ALTER TABLE "guild_config" ADD COLUMN "verification_message_channel_id" text;
ALTER TABLE "guild_config" ADD COLUMN "verification_welcome_message" text;

-- Add notify_channel_id to verification_role_message for role-specific messages
ALTER TABLE "verification_role_message" ADD COLUMN "notify_channel_id" text;
