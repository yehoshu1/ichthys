ALTER TABLE "reaction_role_message"
    ADD COLUMN IF NOT EXISTS "publish_requested_at" timestamp with time zone,
    ADD COLUMN IF NOT EXISTS "last_published_at" timestamp with time zone,
    ADD COLUMN IF NOT EXISTS "last_publish_error" text;

CREATE INDEX IF NOT EXISTS "reaction_role_message_publish_requested_idx"
    ON "reaction_role_message" USING btree ("publish_requested_at");
