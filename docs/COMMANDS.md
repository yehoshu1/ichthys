# Commands Reference

This document contains the complete command surface for the current codebase:

- npm scripts from `package.json`
- Discord slash commands from `src/bot/commands/*`

## npm Scripts

Run scripts with `npm run <script>`.

| Script | Description | Typical Use |
|---|---|---|
| `build` | Compile bot TypeScript (`tsconfig.bot.json`) into `dist/`. | Production bot build |
| `dev` | Run bot in watch mode (`tsx watch`). | Bot local development |
| `dev:all` | Run bot + dashboard together. | Full-stack local development |
| `dashboard:dev` | Run Next.js dashboard on port `4000` in webpack mode. | Dashboard local development |
| `dashboard:build` | Build dashboard for production. | CI/CD and release build |
| `dashboard:start` | Start built dashboard. | Production runtime |
| `start` | Start compiled bot from `dist`. | Production runtime |
| `deploy` | Deploy slash commands to Discord API. | After slash command changes |
| `db:generate` | Generate Drizzle migrations from schema changes. | Migration authoring |
| `db:migrate` | Apply versioned Drizzle migrations to PostgreSQL. | Standard schema rollout |
| `db:push` | Direct schema push (prefer migrations for shared/prod environments). | Local prototyping |
| `db:studio` | Open Drizzle Studio. | Manual DB inspection |
| `db:backup` | Create timestamped DB backup. | Pre-change safety |
| `db:backup:list` | List backups. | Backup audit |
| `db:restore` | Restore DB from backup. | Recovery |
| `db:restore:list` | List restore candidates. | Recovery planning |
| `db:migrate:sqlite-import` | Full SQLite -> PostgreSQL import. | Initial cutover load |
| `db:migrate:delta` | Delta sync SQLite changes to PostgreSQL. | Near-zero cutover sync |
| `db:migrate:verify` | Verify SQLite/PostgreSQL parity checksums and counts. | Cutover validation |
| `deploy:safe` | Safe deployment with backup workflow. | Production deploy safety |

## Slash Command Overview

Current slash command files: `31`

### Public Commands (Anyone)

- `/ping`
- `/info`
- `/rank` or `/profile`
- `/leaderboard` or `/top`
- `/user`
- `/avatar`
- `/server`
- `/roles`
- `/dashboard show`
- `/boost status`
- `/boost claim`

### Moderator Commands

- `/warn add`
- `/warn remove`
- `/warn list`
- `/kick`
- `/ban`
- `/unban`
- `/mute text`
- `/mute voice`
- `/unmute text`
- `/unmute voice`
- `/timeout`
- `/untimeout`
- `/clear`
- `/cases`
- `/vkick`
- `/move`
- `/moveme`
- `/lock`
- `/unlock`
- `/slowmode`
- `/setnick`

### Admin Commands

- `/setup`
- `/config view`
- `/config toggle`
- `/config sync`
- `/welcome test`
- `/verify`
- `/boost setup`
- `/role give`
- `/role remove`
- `/setxp`
- `/setlevel`

- `/reactionrole create`
- `/reactionrole add`
- `/reactionrole remove`
- `/reactionrole list`
- `/reactionrole delete`
- `/birthday admin-set`
- `/birthday admin-remove`
- `/birthday test`

---

## Detailed Slash Commands

## General Commands

### `/moveme`

- Description: Move yourself to a voice channel.
- Permission: Everyone.
- Options:
  - `channel` (channel, optional): The voice channel to move to.
  - `user` (user, optional): Move to the same channel as this user.
- Example: `/moveme channel:#General`
- Example: `/moveme user:@Friend`

---

## Leveling Commands

### `/rank` or `/profile`

- Description: Show level, XP progress, and rank position.
- Permission: Everyone.
- Options:
  - `user` (user, optional): Target user. Defaults to command user.
- Example: `/rank`
- Example: `/rank user:@Member`
- Notes:
  - Rank is shown only when user is rank-eligible (level-one XP threshold logic).
  - If leveling is disabled, command returns disabled notice.
  - `/profile` is an alias for `/rank` with more detailed display.

### `/leaderboard` or `/top`

- Description: Show top 10 leaderboard by selected XP type or time period.
- Permission: Everyone.
- Options:
  - `type` (string, optional for `/leaderboard`): `total`, `text`, `voice`.
  - `period` (string, optional for `/top`): `all`, `day`, `week`, `month`.
- Example: `/leaderboard`
- Example: `/leaderboard type:voice`
- Example: `/top period:week`
- Notes:
  - Requires leveling enabled.

### `/setxp`

- Description: Set a user's XP value (Admin only).
- Permission: `Administrator`.
- Options:
  - `user` (user, required): The user to set XP for.
  - `type` (string, required): `total`, `text`, `voice`.
  - `xp` (integer, required): The new XP value (must be >= 0).
- Example: `/setxp user:@Member type:total xp:5000`
- Example: `/setxp user:@Member type:text xp:2500`

### `/setlevel`

- Description: Set a user's level (Admin only).
- Permission: `Administrator`.
- Options:
  - `user` (user, required): The user to set level for.
  - `type` (string, required): `total`, `text`, `voice`.
  - `level` (integer, required): The new level (must be >= 0).
- Example: `/setlevel user:@Member type:total level:10`
- Example: `/setlevel user:@Member type:voice level:5`

---

## Info Commands

### `/user`

- Description: Display detailed information about a user.
- Permission: Everyone.
- Options:
  - `user` (user, optional): The user to get information about. Defaults to command user.
- Example: `/user`
- Example: `/user user:@Member`

### `/avatar`

- Description: Display a user's avatar or banner.
- Permission: Everyone.
- Options:
  - `user` (user, optional): The user to get the avatar of. Defaults to command user.
  - `type` (string, optional): `server`, `global`, `banner`.
- Example: `/avatar`
- Example: `/avatar user:@Member type:banner`
- Example: `/avatar user:@Member type:server`

### `/server`

- Description: Display detailed information about this server.
- Permission: Everyone.
- Options: None.
- Example: `/server`

### `/roles`

- Description: List all server roles or view role details.
- Permission: Everyone.
- Options:
  - `role` (role, optional): View details for a specific role.
- Example: `/roles`
- Example: `/roles role:@Moderator`

### `/dashboard`

- Description: Show the server dashboard link.
- Permission: Everyone.
- Options: None.
- Example: `/dashboard`
- Notes:
  - The dashboard URL is configured via the `DASHBOARD_URL` environment variable by the bot administrator.
  - If no URL is configured, users will see: "Bot URL not set. Please contact an administrator to set up the URL."

---

## Birthday Commands

### `/birthday set`

- Description: Set your birthday for this server with interactive timezone selection.
- Permission: Everyone.
- Options:
  - `day` (integer, required): Day of birth (1-31).
  - `month` (integer, required): Month of birth (1-12).
  - `year` (integer, optional): Year of birth (for age calculation).
- Example: `/birthday set day:15 month:6 year:1995`
- Notes:
  - After entering your birthday, you'll receive an **interactive timezone dropdown** to select your local timezone.
  - The bot uses your timezone to celebrate your birthday at the right time in your local area.
  - Year is optional; if not provided, age won't be shown.
  - Use `/birthday view` to verify your settings.
  - **Available Timezone Regions**: UTC & North America, Europe/Africa/Middle East, Asia/Oceania

### `/birthday remove`

- Description: Remove your birthday from this server.
- Permission: Everyone.
- Options: None.
- Example: `/birthday remove`

### `/birthday view`

- Description: View a user's birthday information.
- Permission: Everyone.
- Options:
  - `user` (user, optional): User to view (default: yourself).
- Example: `/birthday view`
- Example: `/birthday view user:@Member`
- Notes:
  - Shows days until next birthday.
  - Shows age if year was provided.

### `/birthday list`

- Description: List upcoming birthdays in the server.
- Permission: Everyone.
- Options:
  - `limit` (integer, optional): Number to show (default: 10, max: 50).
- Example: `/birthday list`
- Example: `/birthday list limit:20`

### `/birthday next`

- Description: Show whose birthday is next.
- Permission: Everyone.
- Options: None.
- Example: `/birthday next`

### `/birthday stats`

- Description: Show birthday statistics for the server.
- Permission: Everyone.
- Options: None.
- Example: `/birthday stats`
- Notes:
  - Shows total birthdays, most common month, average age.

### `/birthday admin-set`

- Description: Admin: Set a user's birthday.
- Permission: `Moderate Members`.
- Options:
  - `user` (user, required): User to set birthday for.
  - `day` (integer, required): Day of birth (1-31).
  - `month` (integer, required): Month of birth (1-12).
  - `year` (integer, optional): Year of birth.
- Example: `/birthday admin-set user:@Member day:15 month:6 year:1995`

### `/birthday admin-remove`

- Description: Admin: Remove a user's birthday.
- Permission: `Moderate Members`.
- Options:
  - `user` (user, required): User to remove birthday for.
- Example: `/birthday admin-remove user:@Member`

### `/birthday test`

- Description: Admin: Test birthday message in the configured channel.
- Permission: `Manage Server`.
- Options: None.
- Example: `/birthday test`
- Notes:
  - Sends a test message to verify configuration.

### `/info`

- Description: Show server analytics summary (members, verified %, boosts, actions, voice hours, top XP).
- Permission: Everyone.
- Options: None.
- Example: `/info`

---

## Moderation Commands

### `/warn add`

- Description: Create warning case and notify user.
- Permission: `Moderate Members`.
- Options:
  - `user` (user, required): User to warn.
  - `reason` (string, optional): Reason for warning.
- Example: `/warn add user:@Member reason:Spamming`

### `/warn remove`

- Description: Remove a warning or all warnings for a user.
- Permission: `Moderate Members`.
- Options:
  - `user` (user, optional): Remove all warnings for this user.
  - `warn_id` (string, optional): Specific warning case number to remove.
  - `scope` (string, optional): `all` to remove all warnings for user.
- Example: `/warn remove user:@Member scope:all`
- Example: `/warn remove warn_id:42`

### `/warn list`

- Description: List all warnings for a user.
- Permission: Everyone (can view own), `Moderate Members` (can view others).
- Options:
  - `user` (user, optional): User to view warnings for. Defaults to command user.
- Example: `/warn list`
- Example: `/warn list user:@Member`

### `/kick`

- Description: Kick user and create case.
- Permission: `Kick Members`.
- Options:
  - `user` (user, required): User to kick.
  - `reason` (string, optional): Reason for kicking.
- Example: `/kick user:@Member reason:Repeated violations`

### `/ban`

- Description: Ban user, optionally temporary, with optional message deletion window.
- Permission: `Ban Members`.
- Options:
  - `user` (user, required): User to ban.
  - `reason` (string, optional): Reason for banning.
  - `duration` (string, optional): `10m`, `1h`, `7d` (omit for permanent).
  - `delete_messages` (integer, optional): `0..7` days.
- Example: `/ban user:@Member reason:Raid duration:7d delete_messages:1`
- Notes:
  - Omit `duration` for permanent ban.

### `/unban`

- Description: Remove ban by user ID and create case.
- Permission: `Ban Members`.
- Options:
  - `user_id` (string, required): ID of the user to unban.
  - `reason` (string, optional): Reason for unbanning.
- Example: `/unban user_id:123456789012345678 reason:Appeal accepted`

### `/mute text`

- Description: Mute a user from text channels using the configured mute role.
- Permission: `Moderate Members`.
- Options:
  - `user` (user, required): User to mute.
  - `duration` (string, optional): `10m`, `1h`, `1d`.
  - `reason` (string, optional): Reason for muting.
- Example: `/mute text user:@Member duration:30m reason:Caps spam`
- Notes:
  - Requires `moderation_settings.muteRoleId` configured.

### `/mute voice`

- Description: Mute a user from speaking in voice channels.
- Permission: `Moderate Members`.
- Options:
  - `user` (user, required): User to mute.
  - `duration` (string, optional): `10m`, `1h`, `1d`.
  - `reason` (string, optional): Reason for muting.
- Example: `/mute voice user:@Member duration:30m reason:Mic spam`
- Notes:
  - User must be in a voice channel.

### `/unmute text`

- Description: Remove configured mute role from a user.
- Permission: `Moderate Members`.
- Options:
  - `user` (user, required): User to unmute.
  - `reason` (string, optional): Reason for unmuting.
- Example: `/unmute text user:@Member reason:Served time`

### `/unmute voice`

- Description: Unmute a user from voice channels.
- Permission: `Moderate Members`.
- Options:
  - `user` (user, required): User to unmute.
  - `reason` (string, optional): Reason for unmuting.
- Example: `/unmute voice user:@Member reason:Served time`
- Notes:
  - User must be in a voice channel.

### `/timeout`

- Description: Apply Discord timeout.
- Permission: `Moderate Members`.
- Options:
  - `user` (user, required): User to timeout.
  - `duration` (string, required): `10m`, `1h`, `7d` (max 28 days).
  - `reason` (string, optional): Reason for timeout.
- Example: `/timeout user:@Member duration:2h reason:Cooldown`

### `/untimeout`

- Description: Remove timeout from a user.
- Permission: `Moderate Members`.
- Options:
  - `user` (user, required): User to remove timeout from.
  - `reason` (string, optional): Reason for removing timeout.
- Example: `/untimeout user:@Member reason:Apology accepted`

### `/clear`

- Description: Bulk delete channel messages (up to 100 per call).
- Permission: `Manage Messages`.
- Options:
  - `amount` (integer, required): `1..100`.
  - `user` (user, optional): Filter by author.
  - `reason` (string, optional): Reason for clearing.
- Example: `/clear amount:50`
- Example: `/clear amount:100 user:@Member reason:Cleanup`
- Notes:
  - Discord bulk delete does not remove messages older than 14 days.

### `/vkick`

- Description: Disconnect a user from voice channel.
- Permission: `Move Members`.
- Options:
  - `user` (user, required): User to disconnect.
  - `reason` (string, optional): Reason for voice kick.
- Example: `/vkick user:@Member reason:AFK`

### `/move`

- Description: Move a user to a voice channel.
- Permission: `Move Members`.
- Options:
  - `user` (user, required): User to move.
  - `channel` (channel, optional): Channel to move to.
  - `to_user` (user, optional): Move to same channel as this user.
- Example: `/move user:@Member channel:#General`
- Example: `/move user:@Member to_user:@Friend`

### `/lock`

- Description: Lock a channel to prevent members from sending messages.
- Permission: `Manage Channels`.
- Options:
  - `channel` (channel, optional): Channel to lock (default: current channel).
  - `reason` (string, optional): Reason for locking.
- Example: `/lock`
- Example: `/lock channel:#general reason:Raid protection`

### `/unlock`

- Description: Unlock a previously locked channel.
- Permission: `Manage Channels`.
- Options:
  - `channel` (channel, optional): Channel to unlock (default: current channel).
- Example: `/unlock`
- Example: `/unlock channel:#general`

### `/slowmode`

- Description: Set slowmode for the current channel.
- Permission: `Manage Channels`.
- Options:
  - `time` (string, optional): Duration (e.g., `5s`, `10m`, `1h`, or `0` to disable).
  - `seconds` (integer, optional): Duration in seconds (0 to disable, max 21600).
- Example: `/slowmode time:5s`
- Example: `/slowmode seconds:0`
- Notes:
  - Max slowmode is 6 hours (21600 seconds).

### `/setnick`

- Description: Change a user's nickname.
- Permission: `Manage Nicknames`.
- Options:
  - `user` (user, required): User to change nickname for.
  - `nickname` (string, optional): New nickname (leave empty to remove).
- Example: `/setnick user:@Member nickname:NewName`
- Example: `/setnick user:@Member` (removes nickname)

### `/cases`

- Description: List moderation cases for a user.
- Permission: `Moderate Members`.
- Options:
  - `user` (user, required): User to view cases for.
  - `active_only` (boolean, optional): Only show active cases.
  - `page` (integer, optional, min 1): Page number.
- Example: `/cases user:@Member`
- Example: `/cases user:@Member active_only:true page:2`

---

## Role Management Commands

### `/role give`

- Description: Give a role to a user.
- Permission: `Manage Roles`.
- Options:
  - `user` (user, required): User to give the role to.
  - `role` (role, required): Role to give.
  - `bulk` (boolean, optional): Apply to multiple users.
- Example: `/role give user:@Member role:@Verified`

### `/role remove`

- Description: Remove a role from a user.
- Permission: `Manage Roles`.
- Options:
  - `user` (user, required): User to remove the role from.
  - `role` (role, required): Role to remove.
  - `bulk` (boolean, optional): Apply to multiple users.
- Example: `/role remove user:@Member role:@Muted`

---

## Admin/Setup Commands

### `/setup`

- Description: Open interactive setup panel.
- Permission: `Manage Server`.
- Options: None.
- Example: `/setup`

### `/config view`

- Description: Display key guild feature toggles.
- Permission: `Manage Server`.
- Options: None.
- Example: `/config view`

### `/config toggle`

- Description: Toggle a specific feature.
- Permission: `Manage Server`.
- Options:
  - `feature` (string, required): `welcome`, `verification`, `boost`, `leveling`, `levelup`.
- Example: `/config toggle feature:verification`

### `/config sync`

- Description: Sync guild members into DB for analytics/verification consistency.
- Permission: `Manage Server`.
- Options: None.
- Example: `/config sync`
- Notes:
  - Requires Server Members intent and member fetch access.

### `/welcome test`

- Description: Preview welcome trigger output for a role.
- Permission: `Manage Server`.
- Options:
  - `role` (role, required): Trigger role to test.
- Example: `/welcome test role:@Verified`

### `/verify`

- Description: Manually verify member or apply verification profile.
- Permission: `Manage Roles`.
- Options:
  - `user` (user, required): Member to verify.
  - `profile` (string, optional): Profile name (or matching role name).
- Example: `/verify user:@Member`
- Example: `/verify user:@Member profile:Streamer`
- Notes:
  - Bot must also have `Manage Roles` and proper role hierarchy.

### `/boost setup`

- Description: Create/update reward role config.
- Permission: Runtime check requires `Manage Server`.
- Options:
  - `role_name` (string, required).
  - `primary_color` (string, required, hex like `#FF6B6B`).
  - `secondary_color` (string, optional, hex).
- Example: `/boost setup role_name:Booster primary_color:#2CB7C9 secondary_color:#F4B740`

### `/reactionrole create`

- Description: Create a reaction-role message.
- Permission: `Manage Roles`.
- Options:
  - `channel` (text channel, required).
  - `title` (string, required).
  - `description` (string, optional).
- Example: `/reactionrole create channel:#roles title:Choose your roles`

### `/reactionrole add`

- Description: Add one reaction-role mapping to message.
- Permission: `Manage Roles`.
- Options:
  - `message_id` (string, required).
  - `channel` (text channel, required).
  - `role` (role, required).
  - `emoji` (string, required).
  - `type` (string, optional): `TOGGLE`, `ADD_ONLY`, `REMOVE_ONLY`, `UNIQUE`.
  - `description` (string, optional).
- Example: `/reactionrole add message_id:... channel:#roles role:@Gamer emoji:🎮 type:TOGGLE`

### `/reactionrole remove`

- Description: Remove mapping by message and emoji.
- Permission: `Manage Roles`.
- Options:
  - `message_id` (string, required).
  - `emoji` (string, required).
- Example: `/reactionrole remove message_id:... emoji:🎮`

### `/reactionrole list`

- Description: List active reaction role mappings in guild.
- Permission: `Manage Roles`.
- Options: None.
- Example: `/reactionrole list`

### `/reactionrole delete`

- Description: Delete all mappings for a reaction-role message.
- Permission: `Manage Roles`.
- Options:
  - `message_id` (string, required).
  - `channel` (text channel, required).
- Example: `/reactionrole delete message_id:... channel:#roles`

---

## Boost Commands

### `/boost status`

- Description: Show personal booster/reward status.
- Permission: Everyone.
- Options: None.
- Example: `/boost status`

### `/boost claim`

- Description: Claim configured boost reward role.
- Permission: Everyone (runtime validation requires active booster).
- Options: None.
- Example: `/boost claim`
- Notes:
  - Bot must have `Manage Roles`.

---

## Command Deployment Notes

- Slash command definition changes are not live until redeployed.
- Redeploy command set with:
  - `npm run deploy`

## Permission and Runtime Caveats

- A user passing slash permission checks can still fail runtime checks if bot permissions are insufficient.
- Common bot permissions required across modules:
  - `Manage Roles`
  - `Manage Messages`
  - `Kick Members`
  - `Ban Members`
  - `Moderate Members`
  - `Manage Channels`
  - `Move Members`
  - `Manage Nicknames`
  - `Send Messages` in target channels
