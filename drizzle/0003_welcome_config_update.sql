-- Update welcome_config table with new fields

-- Add new columns for image send mode and canvas dimensions
ALTER TABLE "welcome_config" 
    ADD COLUMN IF NOT EXISTS "image_send_mode" text DEFAULT 'WITH_TEXT',
    ADD COLUMN IF NOT EXISTS "image_channel_id" text,
    ADD COLUMN IF NOT EXISTS "canvas_width" integer DEFAULT 400,
    ADD COLUMN IF NOT EXISTS "canvas_height" integer DEFAULT 200;

-- Add goodbye message columns
ALTER TABLE "welcome_config"
    ADD COLUMN IF NOT EXISTS "goodbye_enabled" boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS "goodbye_channel_id" text,
    ADD COLUMN IF NOT EXISTS "goodbye_message_template" text,
    ADD COLUMN IF NOT EXISTS "goodbye_embed_enabled" boolean DEFAULT false NOT NULL;

-- Drop the old image_position column if it exists (replaced by image_send_mode)
ALTER TABLE "welcome_config" DROP COLUMN IF EXISTS "image_position";

-- Update default values to match ProBot-style centered layout
ALTER TABLE "welcome_config" 
    ALTER COLUMN "avatar_x" SET DEFAULT 155,
    ALTER COLUMN "avatar_y" SET DEFAULT 10,
    ALTER COLUMN "avatar_size" SET DEFAULT 90,
    ALTER COLUMN "avatar_border_width" SET DEFAULT 0,
    ALTER COLUMN "username_x" SET DEFAULT 200,
    ALTER COLUMN "username_y" SET DEFAULT 115,
    ALTER COLUMN "username_size" SET DEFAULT 18,
    ALTER COLUMN "username_align" SET DEFAULT 'center',
    ALTER COLUMN "subtitle_x" SET DEFAULT 200,
    ALTER COLUMN "subtitle_y" SET DEFAULT 140,
    ALTER COLUMN "subtitle_size" SET DEFAULT 16,
    ALTER COLUMN "subtitle_color" SET DEFAULT '#ffffff',
    ALTER COLUMN "background_value" SET DEFAULT 'transparent';
