# ΙΧΘΥΣ Module System

The ΙΧΘΥΣ bot uses a modular architecture that allows server administrators to enable or disable features as needed. This document explains how modules work and how to manage them.

## What is a Module?

A module is a group of related commands and features. Each module can be independently enabled or disabled per server, allowing administrators to customize which features are available.

## Available Modules

### Core Module
**Default State:** Enabled

Contains fundamental bot commands that are always useful:
- `/ping` - Bot latency check
- `/info` - Server analytics overview
- `/avatar` - Display user avatars
- `/user` - Display user information
- `/server` - Display server information
- `/roles` - List server roles
- `/dashboard` - Show dashboard link
- `/moveme`, `/move`, `/moveall` - Voice channel management
- `/setup` - Interactive setup panel
- `/config` - Server configuration
- `/module` - Module management
- `/timestamp` - Discord timestamps

### Leveling Module
**Default State:** Enabled

XP tracking and level rewards system:
- `/rank` - Check current level and XP
- `/profile` - View profile cards
- `/leaderboard` - View XP leaderboard
- `/top` - Time-filtered leaderboard
- `/setxp`, `/setlevel` - Admin XP management

### Events Module
**Default State:** Enabled

Server event creation and management:
- `/create` - Create events
- `/list` - List events and polls
- `/delete` - Delete events or polls
- `/remind` - Set event reminders
- `/settings` - Configure event settings

### Polls Module
**Default State:** Enabled

Voting and polling system:
- `/poll` - Create polls with multiple options

### Moderation Module
**Default State:** Enabled

Tools for server moderation:
- `/warn` - Warning management
- `/mute`, `/unmute` - Text and voice mutes
- `/timeout`, `/untimeout` - User timeouts
- `/kick`, `/vkick` - User removal
- `/ban`, `/unban` - User bans
- `/clear` - Message cleanup
- `/cases` - Moderation case tracking
- `/lock`, `/unlock` - Channel locking
- `/slowmode` - Rate limiting
- `/setnick` - Nickname management
- `/role` - Role management
- `/watchlist` - Staff watchlist

### Welcome Module
**Default State:** Enabled

Welcome messages and member onboarding:
- `/welcome` - Welcome system testing and configuration

### Verification Module
**Default State:** Enabled

Member verification system:
- `/verify` - Manual verification

### Boosts Module
**Default State:** Enabled

Server boost tracking and rewards:
- `/boost` - Boost status and rewards

### Birthdays Module
**Default State:** Enabled

Birthday tracking and announcements:
- `/birthday` - Birthday management

## Managing Modules

### Listing Modules
Use `/module list` to see all available modules and their current state (enabled/disabled).

### Enabling a Module
Use `/module enable <module>` to enable a module. You need the "Manage Server" permission.

### Disabling a Module
Use `/module disable <module>` to disable a module. You need the "Manage Server" permission.

## Module State Storage

Module states are stored in the `module_state` database table with the following structure:
- `guild_id` - The Discord server ID
- `module_id` - The module identifier
- `enabled` - Boolean indicating if the module is active

## Important Notes

1. **Core module cannot be disabled** - Essential bot functionality is always available
2. **Changes are immediate** - Enabling/disabling takes effect immediately
3. **Per-server configuration** - Each server has its own module settings
4. **Commands are hidden** - Disabled module commands won't appear in autocomplete
5. **Database backed** - Module states persist across bot restarts

## Troubleshooting

### Command Not Found
- Check if the module containing the command is enabled
- Use `/module list` to verify module status

### Can't Enable/Disable Module
- Ensure you have "Manage Server" permission
- Verify the module name is correct

### Module State Not Saving
- Check database connectivity
- Verify the bot has write permissions to the database
