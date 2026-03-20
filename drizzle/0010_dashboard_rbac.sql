DO $$
BEGIN
    CREATE TYPE "rbac_default_access" AS ENUM ('manage_guild_only', 'deny');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "dashboard_rbac_config" (
    "guild_id" text PRIMARY KEY,
    "enabled" boolean DEFAULT false NOT NULL,
    "default_access" "rbac_default_access" DEFAULT 'manage_guild_only' NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "dashboard_rbac_rules" (
    "guild_id" text NOT NULL REFERENCES "dashboard_rbac_config"("guild_id") ON DELETE cascade,
    "module_id" text NOT NULL,
    "allowed_view_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "allowed_edit_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT "dashboard_rbac_rules_guild_id_module_id_pk" PRIMARY KEY ("guild_id", "module_id")
);

CREATE INDEX IF NOT EXISTS "dashboard_rbac_rules_guild_id_idx"
    ON "dashboard_rbac_rules" ("guild_id");
