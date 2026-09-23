# ΙΧΘΥΣ Bot Commands Reference

This document provides a complete reference for all slash commands available in the ΙΧΘΥΣ Discord bot.

## General Commands

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/ping` | Check bot latency | Everyone |
| `/info` | View server analytics overview | Everyone |
| `/avatar [user] [type]` | Display user's avatar or banner | Everyone |
| `/user [user]` | Display detailed user information | Everyone |
| `/server` | Display server information | Everyone |
| `/roles [role]` | List server roles or view role details | Everyone |
| `/dashboard` | Show server dashboard link | Everyone |
| `/moveme [channel] [user]` | Move yourself to a voice channel | Everyone |
| `/move <user> [channel] [to_user]` | Move a user to a voice channel | Move Members |
| `/moveall <from> <to>` | Move all users from one voice channel to another | Move Members |
| `/setup` | Interactive setup panel | Manage Server |
| `/config view\|toggle\|sync` | View or update server configuration | Manage Server |
| `/module list\|enable\|disable` | Manage module enable/disable states | Manage Server |
| `/timestamp <datetime> [timezone]` | Generate Discord-formatted timestamps | Everyone |

## Leveling Commands

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/rank [user]` | Check current level and XP | Everyone |
| `/profile [user]` | View profile card with level and XP | Everyone |
| `/leaderboard [type]` | View server XP leaderboard | Everyone |
| `/top [period]` | View leaderboard with time-based filtering | Everyone |
| `/setxp <user> <type> <xp>` | Set a user's XP | Administrator |
| `/setlevel <user> <type> <level>` | Set a user's level | Administrator |

## Event Commands

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/create <title> <datetime> [description] [duration] ...` | Create a new event | Manage Events |
| `/list <type> [channel] [limit]` | List upcoming events or active polls | Everyone |
| `/delete <type> <id> [reason]` | Delete an event or poll | Manage Events |
| `/remind <event_id> <when>` | Set a personal reminder for an event | Everyone |
| `/settings view\|channel\|timezone\|mentions\|permissions\|ai\|discord` | Configure event and poll settings | Manage Server |

## Poll Commands

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/poll <question> <options> [description] [channel] ...` | Create a poll | Everyone |

## Birthday Commands

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/birthday set <day> <month> [year]` | Set your birthday | Everyone |
| `/birthday remove` | Remove your birthday | Everyone |
| `/birthday view [user]` | View a user's birthday | Everyone |
| `/birthday list [limit]` | List upcoming birthdays | Everyone |
| `/birthday next` | View next birthday | Everyone |
| `/birthday admin-set <user> <day> <month> [year]` | Admin: set user's birthday | Manage Server |
| `/birthday admin-remove <user>` | Admin: remove user's birthday | Manage Server |
| `/birthday test` | Test birthday announcement | Manage Server |
| `/birthday stats` | View birthday statistics | Everyone |

## Moderation Commands

### Warnings
| Command | Description | Permissions |
|---------|-------------|-------------|
| `/warn add <user> [reason]` | Add a warning to a user | Moderate Members |
| `/warn remove [user] [warn_id] [scope]` | Remove a warning | Moderate Members |
| `/warn list [user]` | List warnings for a user | Moderate Members |

### Mutes
| Command | Description | Permissions |
|---------|-------------|-------------|
| `/mute text <user> [duration] [reason]` | Mute user from text channels | Moderate Members |
| `/mute voice <user> [duration] [reason]` | Mute user in voice channels | Moderate Members |
| `/unmute text <user> [reason]` | Unmute user from text channels | Moderate Members |
| `/unmute voice <user> [reason]` | Unmute user in voice channels | Moderate Members |

### Timeouts
| Command | Description | Permissions |
|---------|-------------|-------------|
| `/timeout <user> <duration> [reason]` | Timeout a user | Moderate Members |
| `/untimeout <user> [reason]` | Remove timeout from a user | Moderate Members |

### Kicks & Bans
| Command | Description | Permissions |
|---------|-------------|-------------|
| `/kick <user> [reason]` | Kick a user from the server | Kick Members |
| `/vkick <user> [reason]` | Disconnect a user from voice channel | Move Members |
| `/ban <user> [reason] [duration] [delete_messages]` | Ban a user from the server | Ban Members |
| `/unban <user_id> [reason]` | Unban a user from the server | Ban Members |

### Utility
| Command | Description | Permissions |
|---------|-------------|-------------|
| `/clear <amount> [user] [reason]` | Clear messages in the current channel | Manage Messages |
| `/cases <user> [active_only] [page]` | View moderation cases for a user | Moderate Members |
| `/lock [channel] [reason]` | Lock a channel | Manage Channels |
| `/unlock [channel]` | Unlock a previously locked channel | Manage Channels |
| `/slowmode [time] [seconds]` | Set slowmode for the current channel | Manage Channels |
| `/setnick <user> [nickname]` | Change a user's nickname | Manage Nicknames |

### Watchlist
| Command | Description | Permissions |
|---------|-------------|-------------|
| `/watchlist add <member> <reason> [severity] [notes]` | Add member to staff watchlist | Moderate Members |
| `/watchlist remove <member>` | Remove member from watchlist | Moderate Members |
| `/watchlist view <member>` | View watchlist entry for a member | Moderate Members |
| `/watchlist list` | List all watchlist entries | Moderate Members |
| `/watchlist note <member> <note>` | Add note to watchlist entry | Moderate Members |

## Role Management

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/role give <user> <role> [bulk]` | Give a role to a user | Manage Roles |
| `/role remove <user> <role> [bulk]` | Remove a role from a user | Manage Roles |

## Welcome & Verification

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/welcome test <role>` | Test welcome message for a role | Manage Server |
| `/verify <user> [profile]` | Manually verify a user | Manage Server |

## Boosts

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/boost status` | View boost status | Everyone |
| `/boost claim` | Claim boost rewards | Everyone |
| `/boost setup <role_name> <primary_color> [secondary_color]` | Setup boost rewards | Manage Server |

## Command Modules

Commands are organized into modules that can be enabled/disabled per server:

| Module | Commands |
|--------|----------|
| `core` | `/ping`, `/info`, `/avatar`, `/user`, `/server`, `/roles`, `/dashboard`, `/moveme`, `/move`, `/moveall`, `/setup`, `/config`, `/module`, `/timestamp` |
| `leveling` | `/rank`, `/profile`, `/leaderboard`, `/top`, `/setxp`, `/setlevel` |
| `events` | `/create`, `/list`, `/delete`, `/remind`, `/settings` |
| `polls` | `/poll` |
| `moderation` | `/warn`, `/mute`, `/unmute`, `/timeout`, `/untimeout`, `/kick`, `/vkick`, `/ban`, `/unban`, `/clear`, `/cases`, `/lock`, `/unlock`, `/slowmode`, `/setnick`, `/role`, `/watchlist` |
| `welcome` | `/welcome` |
| `verification` | `/verify` |
| `boosts` | `/boost` |
| `birthdays` | `/birthday` |

Use `/module list` to see enabled modules, `/module enable <module>` to enable, and `/module disable <module>` to disable.
