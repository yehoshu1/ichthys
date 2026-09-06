---
title: "Analytics Module"
description: "Growth, activity and heatmap analytics."
---

## Purpose

Analytics provides server health and activity visibility:

- Member totals and verified counts
- Active boosts and retention rate
- Voice-hour aggregates
- Action volume (24h)
- Activity heatmap (weekday/hour)
- Top XP leaderboard snapshot

## Dashboard Location

- Page: `/dashboard/[guildId]/analytics`

## API Endpoints

- `GET /api/guilds/[guildId]/analytics`

## Database Tables

- `user_join`
- `message_activity`
- `guild_growth`
- `action_log`
- `level_profile`
- `user_boost`

## Related Bot Code

- Background jobs:
- `src/bot/jobs/trackGrowth.ts`
- `src/bot/jobs/syncAnalytics.ts`
- `src/bot/jobs/cleanupUserCache.ts` (cache hygiene)
- Source events:
- `src/bot/events/messageCreate.ts`
- `src/bot/events/guildMemberAdd.ts`
- `src/bot/events/guildMemberRemove.ts`
- Summary slash command:
- `/info`

## Data Interpretation Notes

- Heatmap bins are UTC-based hour/day aggregates.
- Retention depends on historical growth and join/leave tracking quality.
- Top active members in analytics use XP-backed data from leveling tables.

## Typical Workflow

1. Use refresh in analytics page after major events.
2. Compare verified ratio vs total member count.
3. Watch heatmap to optimize event timings.
4. Track action spikes to evaluate moderation/load changes.

## Common Failure Modes

- All analytics zeros:
- Database not seeded/synced for existing members.
- Missing heatmap activity:
- Message activity collector path not running.
- Member numbers look off after downtime:
- Run member sync (`/config sync`) and allow scheduled jobs to catch up.
