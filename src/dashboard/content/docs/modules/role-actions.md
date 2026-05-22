---
title: "Role Actions Module"
description: "Automate actions when roles change."
---

## Purpose

Role Actions automate responses when a role is added or removed.

Supported action types include:

- `DM` (send direct message)
- `MSG` (send channel message)
- `KICK` (remove member)
- `LOG` (write to log channel)

## Dashboard Location

- Page: `/dashboard/[guildId]/role-actions`

## API Endpoints

- `GET/POST /api/guilds/[guildId]/role-actions`
- `DELETE /api/guilds/[guildId]/role-actions?id=<actionId>`
- Shared Discord lookup:
- `GET /api/guilds/[guildId]/discord-data`

## Database Tables

- `role_action` (rule definitions)
- `scheduled_role_action` (delayed execution queue)
- `action_log` (execution history)

## Related Bot Code

- Event:
- `src/bot/events/guildMemberUpdate.ts`
- Job:
- `src/bot/jobs/processScheduledRoleActions.ts`

## Trigger and Execution Model

- `triggerType` controls when action fires:
- `ADD`
- `REMOVE`
- `actionDelay` controls immediate vs scheduled execution.
- Delayed actions are queued and processed by scheduled job.

## Typical Workflow

1. Create action with role + trigger + action type.
2. Add optional message content/embed.
3. For `MSG`, configure target channel.
4. For `KICK`, set kick reason and optional message.
5. Enable action and test by adding/removing target role.
6. Inspect `/dashboard/[guildId]/logs` for execution outcome.

## Common Failure Modes

- Action never runs:
- Rule disabled or trigger type mismatched with actual role change.
- Delayed action not executed:
- Scheduled processor not running.
- DM/message failures:
- User DMs disabled or channel permissions missing.
