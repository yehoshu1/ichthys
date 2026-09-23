-- Migration: Add BAN action type to role_action_type enum
--> statement-breakpoint
ALTER TYPE "public"."role_action_type" ADD VALUE 'BAN';
