---
title: "Boost Management Module"
description: "Server-boost tracking and rewards."
---

## Purpose

The Boost module manages Nitro booster lifecycle:

- Detect active boosters
- Assign/remove reward role
- Support claim-based reward flow
- Send welcome and re-boost announcements
- Track expiration and grace-period behavior

## Dashboard Location

- Page: `/dashboard/[guildId]/boosts`

## API Endpoints

- `GET/POST /api/guilds/[guildId]/boosts/config`
- `GET /api/guilds/[guildId]/boosts/stats`
- Shared member lookup:
- `GET /api/guilds/[guildId]/members?ids=...`

## Database Tables

- `guild_config` (boost settings, reward role config)
- `user_boost` (booster state, boost window, reward assignment/removal)

## Related Bot Code

- Slash commands:
- `/boost status`
- `/boost claim`
- `/boost setup`
- Command file: `src/bot/commands/boost.ts`
- Events/jobs:
- `src/bot/events/guildMemberUpdate.ts`
- `src/bot/jobs/cleanupBoosts.ts`

## Typical Workflow

1. Enable boost management in dashboard.
2. Configure reward role name/color and optional existing role.
3. Set announcement channel and message templates.
4. Configure role removal grace period and DM behavior.
5. Run `/boost setup` to create or update role metadata.
6. Booster runs `/boost claim` to receive role.

## Important Notes

- `/boost setup` requires caller Manage Server + bot Manage Roles.
- `/boost claim` checks current boost status before assigning role.
- Reward expiration in `user_boost` is based on boost start plus configured removal days.

## Common Failure Modes

- Claim fails for active booster:
- Reward role not configured, or bot cannot manage role.
- Boosters appear but stats stale:
- Confirm `guildMemberUpdate` events are flowing and job cleanup is running.
- Role not removed after grace period:
- Check cleanup job scheduling and `boostRoleRemovalDays` value.
