-- Migration: Add member_watchlist table for staff watchlist functionality

CREATE TABLE IF NOT EXISTS "member_watchlist" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "guild_id" text NOT NULL,
    "user_id" text NOT NULL,
    "added_by" text NOT NULL,
    "reason" text NOT NULL,
    "notes" text,
    "severity" text DEFAULT 'LOW' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "member_watchlist_guild_id_guild_config_guild_id_fk"
        FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id")
        ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "member_watchlist_guild_user_unique"
    ON "member_watchlist" USING btree ("guild_id", "user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_watchlist_guild_id_idx"
    ON "member_watchlist" USING btree ("guild_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_watchlist_user_id_idx"
    ON "member_watchlist" USING btree ("user_id");
