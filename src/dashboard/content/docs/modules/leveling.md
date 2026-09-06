---
title: "Leveling System Module"
description: "Text and voice XP, levels and role rewards."
---

## Purpose

The Leveling module tracks text and voice activity and converts it into:

- Text XP
- Voice XP
- Total XP
- Calculated level
- Rank position for eligible users
- Optional level reward roles

## Dashboard Location

- Page: `/dashboard/[guildId]/leveling`
- Tabs:
  - `Settings`
  - `Leaderboard`

## API Endpoints

- `GET/POST /api/guilds/[guildId]/leveling/config`
- `GET /api/guilds/[guildId]/leveling/leaderboard`
- `GET/POST /api/guilds/[guildId]/leveling/rewards`
- `DELETE /api/guilds/[guildId]/leveling/rewards?id=<rewardId>`
- Shared Discord lookup data:
  - `GET /api/guilds/[guildId]/discord-data`

## Database Tables

- `guild_config` (leveling toggles and XP rules)
- `level_profile` (per-user XP, level, voice session state)
- `level_reward` (role unlocks by level)

## Related Bot Code

### Slash Commands (Public)

- `/rank (user)` - Show level, XP, and rank position
- `/profile (user)` - Detailed profile with XP breakdown (alias for rank)
- `/leaderboard (type)` - Top 10 by total/text/voice XP
- `/top (period)` - Leaderboard with time filtering (day/week/month)

### Admin Commands

- `/setxp user type xp` - Set user's XP (Administrator)
- `/setlevel user type level` - Set user's level (Administrator)

### Config Commands

- `/config toggle leveling` - Enable/disable leveling
- `/config toggle levelup` - Enable/disable level-up notifications

### Events/Jobs/Services

- `src/bot/events/messageCreate.ts`
- `src/bot/events/voiceStateUpdate.ts`
- `src/bot/jobs/processVoiceXp.ts`
- `src/bot/services/voiceXpService.ts`
- Level helpers in `src/bot/utils/leveling.ts`

## XP and Rank Rules

- Text XP uses min/max random values with cooldown.
- Voice XP is minute-based and processed continuously by job.
- Voice XP eligibility requires non-empty voice channel (human count >= 2).
- Rank visibility in `/rank` is gated by level-one threshold logic in code.

## Admin Commands Usage

### Setting XP

```
/setxp user:@Member type:total xp:5000
/setxp user:@Member type:text xp:2500
/setxp user:@Member type:voice xp:2500
```

### Setting Level

```
/setlevel user:@Member type:total level:10
/setlevel user:@Member type:text level:5
```

Notes:
- Automatically recalculates level based on XP changes.
- Assigns level reward roles if level increased.
- Level type (text/voice) adjusts proportionally or keeps existing values.

## Typical Workflow

1. Enable leveling.
2. Tune text XP min/max/cooldown.
3. Set voice XP per minute.
4. Enable or disable level-up notifications.
5. Configure level-up channel and message template.
6. Add level reward mappings.
7. Validate live with `/rank` and `/leaderboard`.

## Voice XP Live Processing

- Active voice sessions are scanned on a 5-minute cadence.
- Pending elapsed minutes are processed while users remain in VC.
- Leave events still flush pending minutes.
- Session anchors (`voiceJoinedAt`) are advanced in minute increments to preserve sub-minute remainder.

## Common Failure Modes

- **User not ranking:**
  - They may be below level-one threshold.
- **No voice XP while in channel:**
  - Ensure at least two non-bot members are present.
- **Rewards not assigned:**
  - Check bot role hierarchy and reward-role IDs.
