---
title: "Moderation Module"
description: "Warnings, mutes, kicks, bans and cases."
---

## Purpose

Moderation combines manual slash commands and automated filters.

Manual actions:

- Warn (add/remove/list), kick, ban, unban
- Text/voice mute and unmute, timeout, untimeout
- Voice kick, move users between channels
- Lock/unlock channels, set slowmode
- Change nicknames
- Clear messages
- View moderation cases

Automated moderation:

- Spam protection
- Invite filtering
- Word filtering

## Dashboard Location

- Page: `/dashboard/[guildId]/moderation`

## API Endpoints

- `GET/POST /api/guilds/[guildId]/moderation/config`

## Database Tables

- `moderation_settings` (module settings)
- `moderation_case` (manual action history)
- `member_watchlist` (staff watchlist entries)
- `action_log` (automation/action traces)

## Related Bot Code

### Slash Commands

**Warnings:**
- `/warn add` - Create warning case
- `/warn remove` - Remove warning(s)
- `/warn list` - View user warnings

**Kicks:**
- `/kick` - Kick member from server
- `/vkick` - Disconnect from voice channel

**Bans:**
- `/ban` - Ban user (temporary or permanent)
- `/unban` - Unban by user ID

**Mutes:**
- `/mute text` - Apply text mute role
- `/mute voice` - Server mute in voice channels
- `/unmute text` - Remove text mute role
- `/unmute voice` - Remove voice server mute

**Timeouts:**
- `/timeout` - Apply Discord timeout
- `/untimeout` - Remove Discord timeout

**Channel Management:**
- `/lock` - Lock channel (text or voice)
- `/unlock` - Unlock channel
- `/slowmode` - Set rate limit per user
- `/clear` - Bulk delete messages

**User Management:**
- `/move` - Move user to voice channel
- `/setnick` - Change user nickname
- `/role give` - Assign role to user
- `/role remove` - Remove role from user

**Records:**
- `/cases` - List moderation cases for user
- `/watchlist add` - Add member to staff watchlist
- `/watchlist remove` - Remove member from watchlist
- `/watchlist view` - View watchlist entry for a member
- `/watchlist list` - List all watchlisted members
- `/watchlist note` - Add or update notes on a watchlist entry

### Command Files

- Command files in `src/bot/commands/*.ts`

### Auto-mod Event

- `src/bot/events/autoModeration.ts`

## Duration Format

Commands using duration parse these suffixes:

- `m` minutes
- `h` hours
- `d` days

Examples:

- `10m`
- `1h`
- `7d`

## Dashboard Config Details

- Spam settings:
  - threshold (messages/5s)
  - action (`WARN`, `MUTE`, `KICK`)
  - mute duration
- Word filter:
  - enabled state
  - banned word list
  - action (`DELETE`, `WARN`, `MUTE`, `KICK`)
- Invite filter:
  - enabled state
  - action (`DELETE`, `WARN`)
- Log channel and mute role IDs

## Typical Workflow

1. Configure mute role and log channel in dashboard.
2. Enable spam and invite filters as needed.
3. Add banned words list.
4. Use slash moderation commands for manual actions.
5. Use `/cases <user>` to inspect history.

## Common Failure Modes

- **Mute command fails:**
  - Mute role not configured or bot cannot manage role.
- **Timeout/ban/kick fails:**
  - Target higher in role hierarchy or missing permissions.
- **Voice mute/kick/move fails:**
  - User not in voice channel, or bot lacks Move Members permission.
- **Lock/unlock fails:**
  - Bot lacks Manage Channel permissions.
- **Auto-mod not triggering:**
  - Check `autoModEnabled` and filter toggles in moderation settings.
