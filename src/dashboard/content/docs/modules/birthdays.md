---
title: "Birthday Module"
description: "Birthday announcements with timezone support."
---

## Purpose

The Birthday module automatically announces and celebrates member birthdays in your server.

Features:
- Automatic birthday announcements at configured times
- Optional birthday role assignment
- Customizable birthday messages with variables
- Age calculation (optional)
- Timezone support for accurate timing
- Upcoming birthday list

## Dashboard Location

- Page: `/dashboard/[guildId]/birthdays`
- Tabs:
  - `Settings` - Configure birthday announcements
  - `Members` - View members with birthdays set

## API Endpoints

- `GET/POST /api/guilds/[guildId]/birthdays/config` - Birthday configuration
- `GET/POST /api/guilds/[guildId]/birthdays/entries` - Birthday entries
- `DELETE /api/guilds/[guildId]/birthdays/entries?id=<id>` - Remove entry

## Database Tables

- `birthday_config` - Guild birthday settings
- `birthday_entry` - User birthday data
- `birthday_log` - Celebration history

## Related Bot Code

### User Commands

- `/birthday set day month (year)` - Set your birthday with interactive timezone selection
- `/birthday remove` - Remove your birthday
- `/birthday view (user)` - View someone's birthday
- `/birthday list (limit)` - List upcoming birthdays
- `/birthday next` - Show next birthday
- `/birthday stats` - Show birthday statistics

#### Interactive Timezone Selection

When setting your birthday with `/birthday set`, the bot will show an **ephemeral message with an embed containing timezone dropdown menus**:

1. Enter your day, month, and optional year
2. The bot shows an interactive embed with 3 timezone region dropdowns:
   - 🌍 **UTC & North America** (Pacific, Mountain, Central, Eastern, Atlantic, Brazil, Argentina)
   - 🌍 **Europe, Africa & Middle East** (UK, Central Europe, Eastern Europe, Moscow, Turkey, UAE)
   - 🌍 **Asia & Oceania** (India, Thailand, Singapore, China, Hong Kong, Taiwan, Korea, Japan, Australia, New Zealand, Fiji)
3. Select your timezone from the appropriate dropdown
4. Your birthday is saved with your local timezone!

This ensures your birthday is celebrated at the correct time in your local timezone, not just server time.

### Admin Commands

- `/birthday admin-set user day month (year)` - Set a user's birthday
- `/birthday admin-remove user` - Remove a user's birthday
- `/birthday test` - Test birthday message (Manage Server)

### Jobs

- `src/bot/jobs/checkBirthdays.ts` - Hourly birthday check
- `src/bot/jobs/checkBirthdays.ts` - Daily role cleanup

## Configuration Options

| Option | Description |
|--------|-------------|
| Channel | Channel where birthday messages are sent |
| Birthday Role | Role assigned to birthday users |
| Message | Custom message template with variables |
| Hour | Time of day to send messages (0-23) |
| Show Age | Include age in birthday message |
| Mention Role | Role to mention: @everyone, @here, or specific role |
| Auto-Remove Role | Remove role after birthday ends |

## Message Variables

- `{user.mention}` - User mention
- `{user.username}` - Username
- `{user.displayname}` - Display name
- `{user.nickname}` - Server nickname
- `{user.id}` - User ID
- `{age}` - Current age (if year provided)
- `{server.name}` - Server name
- `{server.id}` - Server ID
- `{server.members}` - Member count

## Typical Workflow

1. Enable birthday module in dashboard
2. Configure announcement channel and optional role
3. Customize message template
4. Set announcement time (hour of day)
5. Members set their birthdays with `/birthday set`
6. Bot automatically announces birthdays at configured time

## Common Failure Modes

- **Birthday not announced:**
  - Module not enabled
  - Channel not configured
  - Wrong hour configured (uses server time)
- **Role not assigned:**
  - Bot lacks Manage Roles permission
  - Role is higher than bot's highest role
- **Wrong timezone:**
  - User didn't set their timezone (defaults to UTC)
