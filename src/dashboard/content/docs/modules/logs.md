---
title: "Action Logs Module"
description: "Audit log of actions executed by the bot."
---

## Purpose

The Logs module shows execution history for automated and system actions:

- Action type
- Target user
- Success/failure state
- Error messages
- Metadata payloads
- Execution timestamp

## Dashboard Location

- Page: `/dashboard/[guildId]/logs`

## API Endpoints

- `GET /api/guilds/[guildId]/logs?page=<n>&limit=<n>`

## Database Tables

- `action_log`

## Related Bot Code

- Any subsystem that records action logs contributes entries.
- Common producers:
- role actions processing
- boost cleanup/removal flows
- automation handlers

## Pagination Behavior

- UI requests 50 records per page.
- Next button is enabled when full page returned.

## Typical Workflow

1. Reproduce issue.
2. Open logs page for affected guild.
3. Filter mentally by action type and timestamp.
4. Expand metadata JSON for full context.
5. Correlate with bot process logs if needed.

## Common Failure Modes

- No logs visible:
- Actions may be happening but code path does not write `action_log`.
- Metadata parse errors in UI:
- Malformed JSON in metadata field from custom writer logic.
