-- Migration: Add required_role_ids and required_role_logic to role_action table
--> statement-breakpoint

DO $$ BEGIN
    CREATE TYPE "role_action_required_logic" AS ENUM ('AND', 'OR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

ALTER TABLE "role_action"
    ADD COLUMN IF NOT EXISTS "required_role_ids" text[] DEFAULT '{}' NOT NULL,
    ADD COLUMN IF NOT EXISTS "required_role_logic" "role_action_required_logic" DEFAULT 'AND' NOT NULL;
