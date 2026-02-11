CREATE TYPE "public"."role_component_style" AS ENUM('PRIMARY', 'SECONDARY', 'SUCCESS', 'DANGER');--> statement-breakpoint
CREATE TYPE "public"."role_component_type" AS ENUM('REACTION', 'BUTTON', 'DROPDOWN');--> statement-breakpoint
CREATE TYPE "public"."welcome_avatar_shape" AS ENUM('CIRCLE', 'SQUARE', 'ROUNDED');--> statement-breakpoint
CREATE TYPE "public"."welcome_background_type" AS ENUM('COLOR', 'GRADIENT', 'IMAGE');--> statement-breakpoint
CREATE TYPE "public"."welcome_image_position" AS ENUM('ABOVE', 'BELOW', 'ONLY');--> statement-breakpoint
CREATE TYPE "public"."welcome_target_type" AS ENUM('CHANNEL', 'DM');--> statement-breakpoint
CREATE TABLE "welcome_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"target_type" "welcome_target_type" DEFAULT 'CHANNEL' NOT NULL,
	"channel_id" text,
	"message_template" text,
	"embed_enabled" boolean DEFAULT false NOT NULL,
	"embed_config" jsonb,
	"image_enabled" boolean DEFAULT false NOT NULL,
	"image_position" "welcome_image_position" DEFAULT 'ABOVE' NOT NULL,
	"background_type" "welcome_background_type" DEFAULT 'COLOR' NOT NULL,
	"background_value" text DEFAULT '#36393f',
	"avatar_shape" "welcome_avatar_shape" DEFAULT 'CIRCLE' NOT NULL,
	"avatar_x" integer DEFAULT 150,
	"avatar_y" integer DEFAULT 150,
	"avatar_size" integer DEFAULT 128,
	"avatar_border_color" text DEFAULT '#ffffff',
	"avatar_border_width" integer DEFAULT 4,
	"username_x" integer DEFAULT 300,
	"username_y" integer DEFAULT 130,
	"username_font" text DEFAULT 'Arial',
	"username_size" integer DEFAULT 32,
	"username_color" text DEFAULT '#ffffff',
	"username_align" text DEFAULT 'left',
	"subtitle_enabled" boolean DEFAULT true NOT NULL,
	"subtitle_template" text DEFAULT 'Welcome to {server}!',
	"subtitle_x" integer DEFAULT 300,
	"subtitle_y" integer DEFAULT 180,
	"subtitle_font" text DEFAULT 'Arial',
	"subtitle_size" integer DEFAULT 24,
	"subtitle_color" text DEFAULT '#cccccc',
	"show_server_name" boolean DEFAULT false NOT NULL,
	"server_name_x" integer DEFAULT 300,
	"server_name_y" integer DEFAULT 80,
	"server_name_font" text DEFAULT 'Arial',
	"server_name_size" integer DEFAULT 28,
	"server_name_color" text DEFAULT '#ffffff',
	"cooldown_enabled" boolean DEFAULT false NOT NULL,
	"cooldown_seconds" integer DEFAULT 5,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reaction_role" ALTER COLUMN "emoji" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reaction_role" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "reaction_role" ADD COLUMN "style" "role_component_style" DEFAULT 'PRIMARY';--> statement-breakpoint
ALTER TABLE "reaction_role_message" ADD COLUMN "component_type" "role_component_type" DEFAULT 'REACTION' NOT NULL;--> statement-breakpoint
ALTER TABLE "reaction_role_message" ADD COLUMN "max_selections" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "reaction_role_message" ADD COLUMN "placeholder" text;--> statement-breakpoint
ALTER TABLE "welcome_config" ADD CONSTRAINT "welcome_config_guild_id_guild_config_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_config"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "welcome_config_guild_id_unique" ON "welcome_config" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "welcome_config_guild_id_idx" ON "welcome_config" USING btree ("guild_id");