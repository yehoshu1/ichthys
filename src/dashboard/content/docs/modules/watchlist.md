---
title: "Watchlist Module"
description: "Flag and monitor accounts of interest."
---

## What It Does

The Watchlist module lets staff track suspicious or concerning members without taking formal moderation action. Entries include a severity level, a reason, and optional free-text notes. Both the bot (via `/watchlist` slash commands) and the dashboard provide full CRUD access.

---

## Dashboard Page

`/dashboard/[guildId]/watchlist`

- Lists all watchlist entries, enriched with Discord usernames/avatars.
- Add new entries by Discord User ID, with severity and reason.
- Edit an existing entry's reason, notes, or severity inline.
- Remove entries with a single click.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/guilds/[guildId]/watchlist` | List all watchlist entries (enriched with user info) |
| `POST` | `/api/guilds/[guildId]/watchlist` | Add or update a watchlist entry (upsert by `guildId + userId`) |
| `PATCH` | `/api/guilds/[guildId]/watchlist/[userId]` | Update reason, notes, or severity for an existing entry |
| `DELETE` | `/api/guilds/[guildId]/watchlist/[userId]` | Remove an entry |

All endpoints require **Manage Server** permission.

---

## Database Tables

### `member_watchlist`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `guild_id` | text | References `guild_config(guild_id)` |
| `user_id` | text | Watched Discord user ID |
| `added_by` | text | Discord user ID of the staff member who added the entry |
| `reason` | text | Required, max 500 characters |
| `notes` | text | Optional, max 1 000 characters |
| `severity` | text | `LOW` / `MEDIUM` / `HIGH` (default `LOW`) |
| `created_at` | timestamptz | Auto-set on insert |
| `updated_at` | timestamptz | Updated on every write |

**Unique constraint**: `(guild_id, user_id)` — one entry per member per guild; adding an existing member upserts the record.

---

## Bot Commands

All commands require **Manage Messages** or **Manage Server** permission.

### `/watchlist add`
Add a member to the watchlist (or update their entry if they are already listed).

| Option | Required | Description |
|--------|----------|-------------|
| `member` | ✅ | The member to watch |
| `reason` | ✅ | Why they are being watched (max 500 chars) |
| `severity` | ❌ | `LOW` (default), `MEDIUM`, or `HIGH` |
| `notes` | ❌ | Additional context (max 1 000 chars) |

### `/watchlist remove`
Remove a member from the watchlist.

| Option | Required | Description |
|--------|----------|-------------|
| `member` | ✅ | The member to remove |

### `/watchlist view`
Show the watchlist entry for a specific member.

| Option | Required | Description |
|--------|----------|-------------|
| `member` | ✅ | The member to look up |

### `/watchlist list`
List all members currently on the server watchlist (paginated embed).

### `/watchlist note`
Add or replace the free-text notes on an existing watchlist entry.

| Option | Required | Description |
|--------|----------|-------------|
| `member` | ✅ | The member whose entry to update |
| `note` | ✅ | New note text (max 1 000 chars) |

---

## Typical Workflow

1. A staff member notices suspicious behaviour from `@Member`.
2. They run `/watchlist add member:@Member reason:"Sent DM spam" severity:MEDIUM`.
3. The entry appears in the dashboard and can be seen by other staff.
4. As more incidents occur, `/watchlist note` is used to append context.
5. If the situation escalates, formal moderation is applied (see [Moderation](/docs/modules/moderation)).
6. Once resolved, `/watchlist remove` cleans up the entry.

---

## Failure Modes & Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `relation "member_watchlist" does not exist` | Migration not applied | Run `npm run db:migrate` (or `npm run db:push`) in the production environment |
| Upsert overwrites severity | Expected — adding an existing entry updates all fields | Use `/watchlist view` to check the current state first |
| Dashboard shows no entries | User lacks **Manage Server** permission | Grant the permission in Discord server settings |
