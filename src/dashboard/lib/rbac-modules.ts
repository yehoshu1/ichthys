/**
 * Canonical list of RBAC module IDs used by the dashboard access-control system.
 *
 * Each ID corresponds to the API path segment immediately after
 * /api/guilds/[guildId]/ — e.g. the "welcome" module is served at
 * /api/guilds/[guildId]/welcome.
 *
 * Keep this file free of server-only imports so Next.js can safely bundle it
 * in both server (API routes) and client (settings page) contexts.
 */
export const RBAC_MODULE_IDS = [
    "welcome",
    "verification",
    "leveling",
    "boosts",
    "birthdays",
    "role-actions",
    "aliases",
    "commands",
    "moderation",
    "settings",
    "webhooks",
    "events",
    "polls",
    "notifications",
    "analytics",
] as const;

export type RbacModuleId = (typeof RBAC_MODULE_IDS)[number];
