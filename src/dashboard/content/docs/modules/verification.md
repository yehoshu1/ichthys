---
title: "Verification System Module"
description: "Track verification status and auto-kick stalls."
---

## Purpose

The Verification module protects servers by:

- Tracking verification status per member
- Assigning/removing verification roles
- Auto-kicking users after grace period (optional behavior)
- Supporting role-based verification message rules and profiles

## Dashboard Location

- Page: `/dashboard/[guildId]/verification`
- Includes:
- Core verification config
- Verification profiles/rules
- Role-specific messages
- Verification stats
- Kicked list and unverified list

## API Endpoints

- `GET/POST /api/guilds/[guildId]/verification/config`
- `GET /api/guilds/[guildId]/verification/stats`
- `GET /api/guilds/[guildId]/verification/kicked`
- `GET /api/guilds/[guildId]/verification/unverified`
- `GET/POST /api/guilds/[guildId]/verification/rules`
- `PATCH/DELETE /api/guilds/[guildId]/verification/rules/[ruleId]`
- `GET/POST /api/guilds/[guildId]/verification/role-messages`
- `PATCH/DELETE /api/guilds/[guildId]/verification/role-messages/[messageId]`
- Shared Discord lookup data:
- `GET /api/guilds/[guildId]/discord-data`

## Database Tables

- `guild_config` (verification toggles, grace period, role IDs, message)
- `user_join` (joinedAt, isVerified, verifiedAt, kickedAt)
- `verification_message_rule` (named profiles/rules)
- `verification_role_message` (role-specific post-verification message)
- `action_log` (auto-kick and other action traces)

## Related Bot Code

- Slash command:
- `/verify` in `src/bot/commands/verify.ts`
- Relevant config command:
- `/config toggle verification`
- Events/jobs:
- `src/bot/events/guildMemberAdd.ts`
- `src/bot/events/guildMemberUpdate.ts`
- `src/bot/jobs/cleanupUnverified.ts`

## Typical Workflow

1. Enable verification and set grace period.
2. Set `unverifiedRoleId` and `verificationRoleId`.
3. Optional: set verification message and role-specific overrides.
4. Optional: create named verification profiles with role + message + notify channel.
5. Use `/verify <user>` for manual verification.
6. Use `/verify <user> <profile>` for profile-based verification.

## Behavior Details

- Manual verify flow can remove unverified role and assign verified role.
- Verification profile mode can assign additional role and send profile-specific message.
- Auto-kick cleanup job checks grace-period expiry and can DM before removal based on config.

## Common Failure Modes

- Member never gets verified role:
- Bot lacks `Manage Roles` or role hierarchy is wrong.
- Verification enabled but users still unverified forever:
- Check cleanup job is running and `verificationGraceDays` is set.
- Profile not found in `/verify`:
- Profile lookup matches by profile name or role name; verify exact names.
