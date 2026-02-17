# ΙΧΘΥΣ Bot - Implementation Status

**Last Updated:** 2026-02-11  
**Status:** Production Ready (v2.0)

---

## Overview

This document reflects the actual implementation status of the ΙΧΘΥΣ Discord bot and dashboard. All phases have been completed, including the new Events, Polls, and Webhooks/API integrations.

---

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Bot | Discord.js | v14.25.1 |
| Runtime | Bun | 1.0+ |
| Dashboard | Next.js | v16.1.6 |
| UI | React | v19.2.4 |
| Styling | Tailwind CSS | v4.1.18 |
| Components | shadcn/ui | Latest |
| Database | PostgreSQL | 17 |
| ORM | Drizzle ORM | v0.45.1 |
| Auth | NextAuth.js | v4.24.13 |
| Jobs | node-cron | v4.2.1 |
| Logging | Winston | v3.19.0 |

---

## Implementation Phases

### ✅ PHASE 1: Foundation (COMPLETED)

**Status:** 100% Complete

| Task | Status | Files |
|------|--------|-------|
| Discord.js setup with intents | ✅ | `src/bot/client.ts` |
| TypeScript configuration | ✅ | `tsconfig.json`, `tsconfig.bot.json` |
| Winston logger setup | ✅ | `src/bot/utils/logger.ts` |
| Drizzle ORM + PostgreSQL | ✅ | `src/shared/database/schema.ts`, `client.ts` |
| Guild config service | ✅ | `src/bot/services/guildConfigService.ts` |
| Command loader | ✅ | `src/bot/utils/commandLoader.ts` |
| Event loader | ✅ | `src/bot/utils/eventLoader.ts` |
| Discord OAuth (NextAuth) | ✅ | `src/dashboard/lib/auth.ts` |
| Dashboard layout | ✅ | `src/dashboard/app/layout.tsx` |
| Environment validation | ✅ | `src/bot/index.ts` |

---

### ✅ PHASE 2: Welcome System (COMPLETED)

**Status:** 100% Complete

| Task | Status | Files |
|------|--------|-------|
| Database schema | ✅ | `welcome_trigger`, `message_template` tables |
| Role-based triggers | ✅ | `src/bot/events/guildMemberUpdate.ts` |
| Template engine | ✅ | `src/bot/utils/embeds.ts` |
| Message sending (channel/DM) | ✅ | `sendWelcomeMessage()` in guildMemberUpdate |
| Join tracking | ✅ | `src/bot/events/guildMemberAdd.ts` |
| Leave messages | ✅ | `src/bot/events/guildMemberRemove.ts` |
| Auto-role assignment | ✅ | `guildMemberAdd.ts` |
| Dashboard UI | ✅ | `welcome/page.tsx` |
| API routes | ✅ | `/api/guilds/[guildId]/welcome/*` |
| Template editor | ✅ | `MessageEditor.tsx` with preview |

**Features:**
- ✅ Multiple triggers per guild
- ✅ Role-based trigger matching
- ✅ Template variable substitution
- ✅ Embed support
- ✅ Channel or DM delivery
- ✅ Enable/disable toggles

---

### ✅ PHASE 3: Verification System (COMPLETED)

**Status:** 100% Complete

| Task | Status | Files |
|------|--------|-------|
| Join tracking schema | ✅ | `user_join` table |
| Verification status tracking | ✅ | `isVerified`, `verifiedAt` fields |
| Cleanup cron job | ✅ | `src/bot/jobs/cleanupUnverified.ts` |
| Auto-kick unverified | ✅ | Hourly cron at :00 |
| Grace period config | ✅ | `verificationGraceDays` field |
| Verification command | ✅ | `src/bot/commands/verify.ts` |
| Dashboard UI | ✅ | `verification/page.tsx` |
| API routes | ✅ | `/api/guilds/[guildId]/verification/*` |
| Kick DM notifications | ✅ | `verificationKickDmEnabled` option |
| Verification profiles | ✅ | `verificationMessageRule` table |
| Role-specific messages | ✅ | `verificationRoleMessage` table |

**Features:**
- ✅ Automated kick scheduling
- ✅ Grace period configuration (days)
- ✅ Pre-kick DM notifications
- ✅ Verification role assignment
- ✅ Unverified role management
- ✅ Profile-based verification
- ✅ Statistics tracking
- ✅ Kicked users history

---

### ✅ PHASE 4: Boost Management (COMPLETED)

**Status:** 100% Complete

| Task | Status | Files |
|------|--------|-------|
| Boost detection | ✅ | `src/bot/events/guildMemberUpdate.ts` |
| Boost tracking schema | ✅ | `user_boost` table |
| Welcome messages | ✅ | New boost & re-boost messages |
| Role assignment | ✅ | Automatic on boost |
| 30-day tracking | ✅ | `boostEndsAt` field |
| Auto-removal cron | ✅ | `src/bot/jobs/cleanupBoosts.ts` (daily 3 AM) |
| Boost command | ✅ | `src/bot/commands/boost.ts` |
| Dashboard UI | ✅ | `boosts/page.tsx` |
| API routes | ✅ | `/api/guilds/[guildId]/boosts/*` |
| Claim system | ✅ | `/boost claim` subcommand |

**Features:**
- ✅ New boost detection
- ✅ Re-boost detection
- ✅ Boost end tracking
- ✅ Configurable grace period
- ✅ Custom welcome messages
- ✅ Embed support
- ✅ DM on removal option
- ✅ Role setup command

---

### ✅ PHASE 5: Leveling System (COMPLETED)

**Status:** 100% Complete

| Task | Status | Files |
|------|--------|-------|
| XP tracking schema | ✅ | `level_profile` table |
| Text XP from messages | ✅ | `src/bot/events/messageCreate.ts` |
| Voice XP tracking | ✅ | `src/bot/events/voiceStateUpdate.ts` |
| XP cooldown system | ✅ | `lastTextXpAt` field |
| Level calculation | ✅ | `calculateLevel()` formula |
| Level-up detection | ✅ | Comparison in event handlers |
| Notifications | ✅ | Channel or context messages |
| Role rewards | ✅ | `level_reward` table + assignment |
| Rank command | ✅ | `src/bot/commands/rank.ts` |
| Leaderboard command | ✅ | `src/bot/commands/leaderboard.ts` |
| Dashboard UI | ✅ | `leveling/page.tsx` |
| API routes | ✅ | `/api/guilds/[guildId]/leveling/*` |

**Features:**
- ✅ Random XP per message (min-max range)
- ✅ Cooldown between XP gains
- ✅ Voice XP per minute
- ✅ Session tracking across channel switches
- ✅ Level formula: `0.1 * sqrt(XP)`
- ✅ Role rewards at specific levels
- ✅ Custom level-up messages
- ✅ Embed support
- ✅ Leaderboard (total/text/voice)

---

### ✅ PHASE 6: Role Actions (COMPLETED)

**Status:** 100% Complete

| Task | Status | Files |
|------|--------|-------|
| Role action schema | ✅ | `role_action` table |
| ADD trigger support | ✅ | `triggerType: 'ADD'` |
| REMOVE trigger support | ✅ | `triggerType: 'REMOVE'` |
| DM action | ✅ | `actionType: 'DM'` |
| KICK action | ✅ | `actionType: 'KICK'` |
| LOG action | ✅ | `actionType: 'LOG'` |
| MSG action | ✅ | `actionType: 'MSG'` |
| Delay system | ✅ | `actionDelay` field + setTimeout |
| Action logging | ✅ | `action_log` table |
| Dashboard UI | ✅ | `role-actions/page.tsx` |
| API routes | ✅ | `/api/guilds/[guildId]/role-actions/route.ts` |

**Features:**
- ✅ Multiple action types
- ✅ Delay scheduling
- ✅ Message templating
- ✅ Embed support
- ✅ Enable/disable toggle
- ✅ Audit trail logging

---

### ✅ PHASE 7: Birthdays (COMPLETED)

**Status:** 100% Complete

| Task | Status | Files |
|------|--------|-------|
| Birthday schema | ✅ | `birthday_config`, `birthday_entry` tables |
| Timezone support | ✅ | 400+ timezones supported |
| Daily cron job | ✅ | `src/bot/jobs/birthdayJob.ts` |
| Announcement messages | ✅ | Custom templates with variables |
| Birthday role assignment | ✅ | Auto-assign and remove |
| Birthday commands | ✅ | `/birthday set`, `/birthday remove`, etc. |
| Dashboard UI | ✅ | `birthdays/page.tsx` |
| API routes | ✅ | `/api/guilds/[guildId]/birthdays/*` |
| Admin commands | ✅ | `/birthday admin-set`, `/birthday test` |

**Features:**
- ✅ User timezone selection
- ✅ Age calculation (optional year)
- ✅ Hour-configurable announcements
- ✅ Role mention support
- ✅ Auto-remove birthday role
- ✅ Upcoming birthday list
- ✅ Birthday statistics

---

### ✅ PHASE 8: Reaction Roles (COMPLETED)

**Status:** 100% Complete

| Task | Status | Files |
|------|--------|-------|
| Reaction role schema | ✅ | `reaction_role_message`, `reaction_role` tables |
| Message creation | ✅ | `/reactionrole create` command |
| Role mapping | ✅ | `/reactionrole add` command |
| Toggle mode | ✅ | Add/remove on click |
| Add-only mode | ✅ | Can only add role |
| Remove-only mode | ✅ | Can only remove role |
| Unique mode | ✅ | Only one role from group |
| Button support | ✅ | Discord Button components |
| Dropdown support | ✅ | Discord SelectMenu components |
| Dashboard UI | ✅ | `reaction-roles/page.tsx` |
| API routes | ✅ | `/api/guilds/[guildId]/reaction-roles/*` |

**Features:**
- ✅ Multiple component types (reaction, button, dropdown)
- ✅ Four assignment modes
- ✅ Custom descriptions per role
- ✅ Message editing support
- ✅ Role removal on unreact

---

### ✅ PHASE 9: Events System (COMPLETED)

**Status:** 100% Complete

| Task | Status | Files |
|------|--------|-------|
| Event schema | ✅ | `event`, `event_rsvp`, `event_template` tables |
| Event creation | ✅ | Dashboard + API routes |
| RSVP tracking | ✅ | Yes/No/Maybe/Waitlist |
| Recurring events | ✅ | Daily, weekly, bi-weekly, monthly, yearly |
| Role restrictions | ✅ | Required/blocked/attendee roles |
| Event color themes | ✅ | 10 Discord-themed colors |
| Event templates | ✅ | Reusable configurations |
| Event reminders | ✅ | Scheduled notifications |
| Event log | ✅ | Audit trail |
| Dashboard UI | ✅ | `events/page.tsx` (500+ lines) |
| API routes | ✅ | `/api/guilds/[guildId]/events/*` |

**Features:**
- ✅ Visual event cards with color coding
- ✅ RSVP counts and waitlist management
- ✅ Recurring schedules with end dates
- ✅ Role-based access control
- ✅ Mention on create/start
- ✅ Duration presets (15m - 4h)
- ✅ Event duplication

---

### ✅ PHASE 10: Polls System (COMPLETED)

**Status:** 100% Complete

| Task | Status | Files |
|------|--------|-------|
| Poll schema | ✅ | `poll`, `poll_option`, `poll_vote` tables |
| Standard polls | ✅ | Multiple choice voting |
| Time polls | ✅ | When2meet-style scheduling |
| Anonymous polls | ✅ | Hidden voter identities |
| Multiple votes | ✅ | Vote for multiple options |
| Custom options | ✅ | Users can add options |
| Poll templates | ✅ | Reusable configurations |
| Auto-close | ✅ | Time-based closing |
| Visual results | ✅ | Bar charts with percentages |
| Dashboard UI | ✅ | `polls/page.tsx` (600+ lines) |
| API routes | ✅ | `/api/guilds/[guildId]/polls/*` |

**Features:**
- ✅ 3 poll types (standard, time, anonymous)
- ✅ Time slot generation for time polls
- ✅ Multiple votes per user (configurable)
- ✅ Max votes limit
- ✅ Anonymous voting mode
- ✅ Role restrictions
- ✅ Visual results with winner highlighting

---

### ✅ PHASE 11: Webhooks & API (COMPLETED)

**Status:** 100% Complete

| Task | Status | Files |
|------|--------|-------|
| Webhook schema | ✅ | `webhook_endpoint`, `webhook_delivery` tables |
| Webhook management | ✅ | Create, edit, enable/disable |
| Event types | ✅ | 10 event types (events, polls, rsvps, etc.) |
| Secret signatures | ✅ | HMAC-SHA256 verification |
| Delivery logs | ✅ | Status codes, timing, errors |
| API key schema | ✅ | `api_key` table |
| API key generation | ✅ | Secure random key generation |
| Permissions system | ✅ | 8 granular permissions |
| Key expiration | ✅ | Optional expiration dates |
| Usage tracking | ✅ | Use count and last used |
| Dashboard UI | ✅ | `webhooks/page.tsx` |
| API routes | ✅ | `/api/guilds/[guildId]/webhooks/*`, `/api/guilds/[guildId]/api-keys/*` |

**Features:**
- ✅ 10 webhook event types
- ✅ HMAC-SHA256 signature verification
- ✅ Delivery log history
- ✅ Webhook health monitoring
- ✅ Granular API permissions
- ✅ API key expiration

---

## Database Schema Summary

```
guild_config (10+ configuration fields)
├── welcome settings (enabled, channel, messages)
├── verification settings (enabled, roles, grace days)
├── boost settings (enabled, role, messages, grace period)
├── leveling settings (enabled, XP rates, cooldowns)
└── moderation settings (mute role, log channel)

welcome_trigger
├── guildId, roleId, channelId, templateId
├── enabled, timestamps

message_template
├── guildId, name, content
├── embed settings (enabled, title, desc, color, etc.)

user_join
├── guildId, userId, joinedAt, isVerified, verifiedAt
├── kickedAt, isBot, timestamps

user_boost
├── guildId, userId, boostedAt, boostEndsAt
├── roleAssigned, roleRemoved, timestamps

level_profile
├── guildId, userId, textXp, voiceXp, totalXp
├── level, lastTextXpAt, voiceJoinedAt, totalVoiceMinutes

level_reward
├── guildId, level, roleId

role_action
├── guildId, roleId, triggerType, actionType
├── actionDelay, dmMessage, channelId, kickReason, logChannelId

action_log
├── guildId, actionType, targetUserId, executedAt
├── success, errorMessage, metadata

message_activity
├── guildId, hour, day, date, messageCount

message_alias
├── guildId, trigger, response, embed
├── cooldown, requirePrefix, caseSensitive

birthday_config
├── guildId, enabled, channelId, roleId
├── messageTemplate, hourOfDay, showAge, mentionRoleId

birthday_entry
├── guildId, userId, day, month, year
├── timezone, nextBirthday

reaction_role_message
├── guildId, channelId, messageId
├── componentType, style, title, description

reaction_role
├── messageId, roleId, emoji, description, type

moderation_case
├── guildId, userId, moderatorId, type
├── reason, duration, expiresAt, active

event
├── guildId, creatorId, title, description
├── startTime, endTime, timezone, color
├── maxAttendees, enableWaitlist, repeatFrequency
├── mentionRoleIds, requiredRoleIds, attendeeRoleId

event_rsvp
├── eventId, userId, status, note

event_template
├── guildId, name, defaultTitle, defaultDescription
├── defaultDuration, defaultColor

poll
├── guildId, creatorId, question, description
├── type (STANDARD/TIME/ANONYMOUS), allowMultipleVotes
├── maxVotesPerUser, allowCustomOptions, isAnonymous
├── endTime, allowedRoleIds, mentionRoleIds

poll_option
├── pollId, text, emoji, order

poll_vote
├── pollId, optionId, userId

poll_template
├── guildId, name, type, question
├── defaultOptions, allowMultipleVotes

webhook_endpoint
├── guildId, name, url, secret
├── eventTypes, enabled, failureCount
├── lastFailureAt, lastSuccessAt

webhook_delivery
├── webhookId, eventType, payload
├── statusCode, success, error, createdAt

api_key
├── guildId, name, keyHash, permissions
├── createdBy, enabled, useCount, expiresAt
```

---

## API Endpoints

### Guild Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/guilds` | List user's guilds |
| GET | `/api/guilds/[guildId]` | Guild info + bot status |

### Welcome System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/guilds/[guildId]/welcome/config` | Get welcome settings |
| POST | `/api/guilds/[guildId]/welcome/config` | Update settings |
| GET | `/api/guilds/[guildId]/welcome/templates` | List templates |
| POST | `/api/guilds/[guildId]/welcome/templates` | Create template |
| PUT | `/api/guilds/[guildId]/welcome/templates` | Update template |
| DELETE | `/api/guilds/[guildId]/welcome/templates?id=` | Delete template |
| GET | `/api/guilds/[guildId]/welcome/triggers` | List triggers |
| POST | `/api/guilds/[guildId]/welcome/triggers` | Create trigger |
| PATCH | `/api/guilds/[guildId]/welcome/triggers` | Update trigger |
| DELETE | `/api/guilds/[guildId]/welcome/triggers?id=` | Delete trigger |

### Verification System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/guilds/[guildId]/verification/config` | Get settings |
| POST | `/api/guilds/[guildId]/verification/config` | Update settings |
| GET | `/api/guilds/[guildId]/verification/stats` | Get statistics |
| GET | `/api/guilds/[guildId]/verification/kicked` | List kicked users |
| GET | `/api/guilds/[guildId]/verification/unverified` | List unverified |
| GET | `/api/guilds/[guildId]/verification/rules` | List rules |
| POST | `/api/guilds/[guildId]/verification/rules` | Create rule |
| PATCH | `/api/guilds/[guildId]/verification/rules/[ruleId]` | Update rule |
| DELETE | `/api/guilds/[guildId]/verification/rules/[ruleId]` | Delete rule |
| GET | `/api/guilds/[guildId]/verification/role-messages` | List messages |
| POST | `/api/guilds/[guildId]/verification/role-messages` | Create message |
| PATCH | `/api/guilds/[guildId]/verification/role-messages/[id]` | Update |
| DELETE | `/api/guilds/[guildId]/verification/role-messages/[id]` | Delete |

### Leveling System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/guilds/[guildId]/leveling/config` | Get settings |
| POST | `/api/guilds/[guildId]/leveling/config` | Update settings |
| GET | `/api/guilds/[guildId]/leveling/rewards` | List rewards |
| POST | `/api/guilds/[guildId]/leveling/rewards` | Create reward |
| DELETE | `/api/guilds/[guildId]/leveling/rewards?id=` | Delete reward |
| GET | `/api/guilds/[guildId]/leveling/leaderboard` | Get leaderboard |

### Boost Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/guilds/[guildId]/boosts/config` | Get settings |
| POST | `/api/guilds/[guildId]/boosts/config` | Update settings |
| GET | `/api/guilds/[guildId]/boosts/stats` | Get statistics |

### Birthdays
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/guilds/[guildId]/birthdays/config` | Get settings |
| POST | `/api/guilds/[guildId]/birthdays/config` | Update settings |
| GET | `/api/guilds/[guildId]/birthdays/entries` | List entries |
| DELETE | `/api/guilds/[guildId]/birthdays/entries?id=` | Delete entry |

### Reaction Roles
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/guilds/[guildId]/reaction-roles` | List messages |
| POST | `/api/guilds/[guildId]/reaction-roles` | Create message |
| DELETE | `/api/guilds/[guildId]/reaction-roles?id=` | Delete message |
| GET | `/api/guilds/[guildId]/reaction-roles/messages` | List with roles |
| POST | `/api/guilds/[guildId]/reaction-roles/messages` | Create full message |

### Moderation
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/guilds/[guildId]/moderation/config` | Get settings |
| POST | `/api/guilds/[guildId]/moderation/config` | Update settings |

### Events
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/guilds/[guildId]/events` | List events |
| POST | `/api/guilds/[guildId]/events` | Create event |
| GET | `/api/guilds/[guildId]/events/[eventId]` | Get event details |
| PATCH | `/api/guilds/[guildId]/events/[eventId]` | Update event |
| DELETE | `/api/guilds/[guildId]/events/[eventId]` | Delete event |
| GET | `/api/guilds/[guildId]/events/templates` | List templates |
| POST | `/api/guilds/[guildId]/events/settings` | Update settings |

### Polls
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/guilds/[guildId]/polls` | List polls |
| POST | `/api/guilds/[guildId]/polls` | Create poll |
| GET | `/api/guilds/[guildId]/polls/[pollId]` | Get poll details |
| PATCH | `/api/guilds/[guildId]/polls/[pollId]` | Update poll |
| DELETE | `/api/guilds/[guildId]/polls/[pollId]` | Delete poll |
| GET | `/api/guilds/[guildId]/polls/[pollId]/results` | Get results |
| GET | `/api/guilds/[guildId]/polls/templates` | List templates |
| POST | `/api/guilds/[guildId]/polls/templates` | Create template |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/guilds/[guildId]/webhooks` | List webhooks |
| POST | `/api/guilds/[guildId]/webhooks` | Create webhook |
| PATCH | `/api/guilds/[guildId]/webhooks/[webhookId]` | Update webhook |
| DELETE | `/api/guilds/[guildId]/webhooks/[webhookId]` | Delete webhook |
| GET | `/api/guilds/[guildId]/webhooks/[webhookId]/logs` | Get delivery logs |
| POST | `/api/guilds/[guildId]/webhooks/[webhookId]/test` | Send test webhook |

### API Keys
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/guilds/[guildId]/api-keys` | List API keys |
| POST | `/api/guilds/[guildId]/api-keys` | Create API key |
| PATCH | `/api/guilds/[guildId]/api-keys/[keyId]` | Update key |
| DELETE | `/api/guilds/[guildId]/api-keys/[keyId]` | Delete key |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/guilds/[guildId]/analytics` | Get all analytics |

### Discord Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/guilds/[guildId]/discord-data` | Get roles/channels |
| GET | `/api/guilds/[guildId]/members` | Get members (paginated) |
| GET | `/api/guilds/[guildId]/channels` | Get channels |

---

## Bot Commands Summary

### Public Commands (Anyone)
- `/rank [user]` - Check level and XP
- `/leaderboard [type]` - View leaderboard
- `/top [period]` - View top members
- `/boost status` - Check boost status
- `/boost claim` - Claim booster role
- `/birthday set` - Set your birthday
- `/birthday view` - View birthday info
- `/birthday list` - List upcoming birthdays
- `/birthday next` - Show next birthday
- `/birthday stats` - Birthday statistics
- `/ping` - Check latency
- `/info` - Server overview
- `/user [user]` - User information
- `/avatar [user]` - Show avatar
- `/server` - Server information
- `/roles` - List roles
- `/dashboard` - Get dashboard link
- `/moveme` - Move to voice channel

### Moderator Commands
- `/warn add` - Warn a user
- `/warn remove` - Remove warning
- `/warn list` - List warnings
- `/kick` - Kick user
- `/ban` - Ban user
- `/unban` - Unban user
- `/mute text` - Mute from text
- `/mute voice` - Mute from voice
- `/unmute text` - Unmute text
- `/unmute voice` - Unmute voice
- `/timeout` - Apply timeout
- `/untimeout` - Remove timeout
- `/clear` - Bulk delete messages
- `/cases` - View moderation cases
- `/vkick` - Voice kick
- `/move` - Move user
- `/lock` - Lock channel
- `/unlock` - Unlock channel
- `/slowmode` - Set slowmode
- `/setnick` - Change nickname
- `/role give` - Give role
- `/role remove` - Remove role
- `/birthday admin-set` - Set user's birthday
- `/birthday admin-remove` - Remove user's birthday

### Admin Commands
- `/setup` - Interactive setup panel
- `/config view` - View configuration
- `/config toggle` - Toggle features
- `/config sync` - Sync members
- `/welcome test` - Test welcome message
- `/verify` - Manually verify user
- `/boost setup` - Configure boost rewards
- `/birthday test` - Test birthday message
- `/setxp` - Set user XP
- `/setlevel` - Set user level
- `/reactionrole create` - Create reaction role message
- `/reactionrole add` - Add role to message
- `/reactionrole remove` - Remove role from message
- `/reactionrole list` - List reaction roles
- `/reactionrole delete` - Delete reaction role message

---

## Known Limitations

1. **Growth Chart**: Historical growth data not fully implemented
2. **Rate Limiting**: No API rate limiting implemented
3. **Permission Validation**: API routes check auth but not guild permissions
4. **Large Guilds**: Member sync limited to 1000 users

---

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database pushed (`bun run db:push`)
- [ ] Commands deployed (`bun run deploy`)
- [ ] Dashboard built (`bun run dashboard:build`)
- [ ] Backup script tested
- [ ] Discord intents enabled
- [ ] OAuth redirect URIs configured
- [ ] Bot permissions verified

---

**End of Implementation Status**
