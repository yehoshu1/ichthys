-- Add mirror_to_discord_events column to event_poll_settings table
ALTER TABLE "event_poll_settings" ADD COLUMN "mirror_to_discord_events" boolean DEFAULT true NOT NULL;
