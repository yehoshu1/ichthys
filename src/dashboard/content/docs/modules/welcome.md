---
title: "Welcome System Module"
description: "Role-aware welcome message triggers."
---

## Purpose

The Welcome module handles:

- Auto-role assignment on member join
- Join/leave announcements
- Role-triggered welcome templates
- Rich message templates with optional embeds

## Dashboard Location

- Page: `/dashboard/[guildId]/welcome`
- Tabs:
- `General Settings`
- `Role Triggers`
- `Message Templates`

## API Endpoints

- `GET/POST /api/guilds/[guildId]/welcome/config`
- `GET/POST /api/guilds/[guildId]/welcome/triggers`
- `DELETE /api/guilds/[guildId]/welcome/triggers?id=<triggerId>`
- `GET/POST /api/guilds/[guildId]/welcome/templates`
- `DELETE /api/guilds/[guildId]/welcome/templates?id=<templateId>`
- Shared Discord lookup data:
- `GET /api/guilds/[guildId]/discord-data`

## Database Tables

- `guild_config` (core welcome toggles and join/leave message fields)
- `welcome_trigger` (role -> template mapping)
- `message_template` (reusable template content and embed options)

## Related Bot Code

- Slash command:
- `/welcome test` in `src/bot/commands/welcome.ts`
- Events:
- `src/bot/events/guildMemberAdd.ts`
- `src/bot/events/guildMemberRemove.ts`
- `src/bot/events/guildMemberUpdate.ts`

## Message Variables

Template variables currently supported by UI/editor and bot usage include:

- `{user}`
- `{username}`
- `{server}`
- `{memberCount}`
- Role trigger test also includes `{role}`, `{date}`, `{time}`

## Typical Workflow

1. Enable welcome module in General Settings.
2. Configure optional auto-role for new joins.
3. Create one or more message templates.
4. Create role triggers linking role IDs to templates.
5. Use `/welcome test <role>` to preview output before going live.

## Operational Notes

- Role-triggered templates and join/leave messages are separate features.
- Missing channels/roles after Discord changes can make a trigger appear valid in DB but fail at send time.
- If verification role also has a welcome trigger, verify flow may suppress duplicate verification messaging.

## Troubleshooting

- No message on role add:
- Confirm trigger is enabled.
- Confirm role ID still exists.
- Confirm bot can send in target channel.
- `/welcome test` says trigger missing:
- Check trigger role exactly matches selected role.
- Auto-role not applied on join:
- Verify role hierarchy and bot permissions.
