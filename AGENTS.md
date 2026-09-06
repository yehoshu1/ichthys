# ΙΧΘΥΣ (Ichthys) Discord Bot & Dashboard - Agent Guide

This document provides essential information for AI coding agents working on the Ichthys project.

> **CRITICAL**: All agents MUST follow the branching guidelines below for every change.
> Never commit directly to `main`. Always create a feature/fix/chore/refactor branch.

## Branching Guidelines

### Branch Structure

```
main                    # Production-ready code, protected
├── feature/*           # New features and enhancements
├── fix/*               # Bug fixes
├── chore/*             # Maintenance, deps, config, docs
└── refactor/*          # Code refactoring (no functional changes)
```

### Branch Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/<short-description>` | `feature/birthday-timezone-selector` |
| Fix | `fix/<short-description>` | `fix/welcome-image-canvas-size` |
| Chore | `chore/<short-description>` | `chore/update-deps-sept-2026` |
| Refactor | `refactor/<short-description>` | `refactor/extract-event-service` |

Use lowercase with hyphens. Keep descriptions under 50 characters.

### Workflow for ALL Changes

Every change, no matter how small, MUST follow this workflow:

1. **Create a branch from `main`:**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b <type>/<description>
   ```

2. **Make your changes** on the branch

3. **Verify before committing:**
   ```bash
   npm run typecheck    # Must pass
   npm run test         # Must pass (pre-existing failures are OK)
   npm run build        # Must succeed
   ```

4. **Commit with conventional format:**
   ```
   type(scope): short description

   - detail 1
   - detail 2
   ```

   Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `ci`

5. **Push and create a Pull Request:**
   ```bash
   git push origin <branch>
   ```

6. **Merge only after CI passes and review**

### What Counts as Each Type

- **feature/**: New functionality, new commands, new dashboard pages, new API endpoints
- **fix/**: Bug fixes, error handling improvements, behavior corrections
- **chore/**: Dependency updates, config changes, documentation, cleanup, CI changes
- **refactor/**: Code restructuring with no behavior change, extracting functions, reorganizing files

### Rules

- **NEVER** commit directly to `main`
- **NEVER** skip typecheck/tests before committing
- **ALWAYS** use conventional commit messages
- **ALWAYS** create a PR even for small changes (enables review and CI)
- Database schema changes MUST be non-destructive (no data loss)
- Schema changes MUST have a backup step documented in the PR

## Project Overview

ΙΧΘΥΣ is a feature-rich Discord bot with a comprehensive web dashboard for community management. It provides welcome messages, verification tracking, boost management, leveling system, role-based actions, events, polls, and more.

**Key Features:**
- **Welcome System**: Role-based message triggers with customizable templates
- **Verification**: Auto-kick unverified members after grace period
- **Boost Management**: Track server boosts and reward boosters
- **Leveling System**: XP tracking for text and voice with role rewards
- **Role Actions**: Automate actions (DM, Kick, Log) when roles change
- **Birthdays**: Automatic birthday announcements with timezone support
- **Events**: Event creation with RSVP, recurring schedules, role restrictions
- **Polls**: Standard, time polls (When2meet-style), and anonymous voting
- **Reaction Roles**: Self-assignable roles via reactions/buttons/dropdowns
- **Moderation**: Warnings, mutes, kicks, bans, case tracking
- **Webhooks**: Real-time event notifications
- **API Keys**: Programmatic access with granular permissions
- **Analytics Dashboard**: Visualize server growth and activity

## Technology Stack

| Component | Technology |
|-----------|------------|
| Bot | Discord.js v14, TypeScript, Node.js 22+ |
| Dashboard | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Database | PostgreSQL 17 with Drizzle ORM |
| Authentication | NextAuth.js v4 with Discord OAuth2 |
| Logging | Winston with daily rotation |
| Process Manager | PM2 |
| Package Manager | npm 11.9.0 |

## Project Structure

```
ichthys/
├── src/
│   ├── bot/                    # Discord bot code
│   │   ├── commands/           # Slash commands
│   │   ├── events/             # Discord event handlers
│   │   ├── jobs/               # Cron jobs (cleanup tasks)
│   │   ├── services/           # Business logic services
│   │   ├── types/              # TypeScript type definitions
│   │   └── utils/              # Utility functions
│   ├── dashboard/              # Next.js dashboard app
│   │   ├── app/                # App router pages
│   │   │   ├── api/            # API routes (REST endpoints)
│   │   │   ├── dashboard/      # Dashboard pages (per-guild)
│   │   │   └── ...             # Public pages
│   │   ├── components/         # React components
│   │   │   └── ui/             # shadcn/ui components
│   │   ├── lib/                # Utilities (auth, db, helpers)
│   │   └── types/              # TypeScript declarations
│   ├── shared/                 # Code shared between bot and dashboard
│   │   ├── database/           # Drizzle schema and client
│   │   └── types/              # Shared type definitions
│   └── utils/                  # Build/deployment utilities
├── docs/                       # Documentation
│   ├── SETUP.md               # Setup and installation guide
│   ├── COMMANDS.md            # Bot commands reference
│   ├── DASHBOARD.md           # Dashboard user guide
│   └── MODULES.md             # Module documentation
├── drizzle/                    # Database migrations (generated)
├── logs/                       # Application logs (runtime)
├── drizzle.config.ts          # Drizzle ORM configuration
├── tailwind.config.ts         # Tailwind CSS configuration
├── ecosystem.config.js        # PM2 process configuration
├── tsconfig.json              # TypeScript config (Next.js/dashboard)
└── tsconfig.bot.json          # TypeScript config (bot only)
```

## Build Commands

```bash
# Development
npm run dev                    # Start bot with hot reload
npm run dashboard:dev          # Start Next.js dev server
npm run dev:all                # Run both bot and dashboard concurrently

# Build
npm run build                  # Compile bot to dist/ (uses tsconfig.bot.json)
npm run dashboard:build        # Build Next.js for production

# Production
npm start                      # Run compiled bot from dist/
npm run dashboard:start        # Start Next.js production server

# Database
npm run db:generate            # Generate Drizzle migrations
npm run db:push                # Push schema changes to database
npm run db:studio              # Open Drizzle Studio GUI

# Deployment
npm run deploy                 # Deploy slash commands to Discord
```

## Code Style Guidelines

### TypeScript
- Use strict TypeScript with explicit types
- Prefer interfaces over type aliases for object shapes
- Use `function` keyword for top-level utilities, arrow functions for callbacks
- Export types from `src/shared/database/schema.ts` for all database entities

### Naming Conventions
- **Files**: kebab-case for most files (e.g., `guildMemberAdd.ts`)
- **Classes**: PascalCase (e.g., `GuildConfigService`)
- **Interfaces/Types**: PascalCase (e.g., `Command`, `GuildConfig`)
- **Variables/Functions**: camelCase (e.g., `loadCommands`, `guildId`)
- **Constants**: UPPER_SNAKE_CASE for true constants only
- **Database Tables**: snake_case in schema, camelCase in TypeScript

### Discord.js Patterns
- Commands follow the `Command` interface: `{ data: SlashCommandBuilder, execute: Function }`
- Event handlers are functions that set up listeners (see `src/bot/events/`)
- Use `client.commands` Collection for command storage
- Always handle interaction errors with try-catch blocks

### React/Next.js Patterns
- Use Server Components by default
- Client Components only when needed (interactivity, browser APIs)
- Place client components in `components/` with clear naming
- Use `AuthProvider` for session management
- API routes follow RESTful patterns under `app/api/guilds/[guildId]/`

## UI Component Guidelines
- **Always use shadcn/ui components first** - Check `src/dashboard/components/ui/` for existing components
- Extend shadcn components rather than creating custom ones when possible
- Use the shadcn CLI to add new components: `npx shadcn add <component>`
- For date/time pickers, use the custom `DateTimePicker` and `DatePicker` from `components/ui/datetime-picker.tsx`
- Use `RoleMultiSelect` and `ChannelMultiSelect` from `components/DiscordSelectors.tsx` for multi-select role/channel inputs

### Database Patterns
- Use Drizzle ORM for all database operations
- Import `db` from `@shared/database/client`
- Use typed queries: `db.select().from(guildConfig).where(eq(guildConfig.guildId, id))`
- Update `updatedAt` timestamps on modifications

## Testing

This project does not currently have automated test suites. Testing is done manually:

1. **Bot Testing**: Use the test Discord server to verify commands and events
2. **Dashboard Testing**: Test API routes with actual Discord OAuth flow
3. **Database Testing**: Use `npm run db:studio` to verify data integrity

When adding new features:
- Test both success and error paths
- Verify database schema changes work with existing data
- Test Discord permissions handling

## Environment Variables

Required in `.env` file:

```env
# Discord Bot (Required)
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret

# NextAuth (Required for dashboard)
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32

# Database (all required - no defaults)
DATABASE_URL=postgresql://user:password@host:5432/dbname
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=ichthys
POSTGRES_USER=ichthys
POSTGRES_PASSWORD=your_secure_password

# Optional
LOG_LEVEL=info                    # debug, info, warn, error
NODE_ENV=development              # development, production
PORT=4002                         # Dashboard port
GUILD_ID=your_test_guild_id       # For testing slash commands
DASHBOARD_URL=https://yourdomain.com  # For /dashboard command
DOMAIN=yourdomain.com             # Domain for reverse proxy routing

# Security (dashboard)
# Comma-separated allowlist of origins for CSRF same-origin checks. When set,
# client-supplied X-Forwarded-* headers are ignored for origin validation.
TRUSTED_ORIGINS=https://yourdomain.com
# Number of trusted proxies in front of the dashboard (e.g. 1 behind Caddy or
# a reverse proxy). 0/unset = treat the app as directly exposed and ignore
# X-Forwarded-For for rate limiting.
TRUST_PROXY_DEPTH=1
```

## Security Considerations

1. **Never commit `.env` file** - It's in `.gitignore` for a reason
2. **Discord Token Security**: Regenerate immediately if exposed
3. **OAuth Scopes**: Dashboard only requests `identify` and `guilds` scopes
4. **API Authorization**: Dashboard API routes check user has access to requested guild
5. **SQL Injection**: Protected by Drizzle ORM parameterized queries
6. **XSS Protection**: React's built-in escaping, plus careful handling of Discord content
7. **API Keys**: Stored as SHA-256 hashes, only shown once on creation
8. **Webhook Secrets**: Stored as SHA-256 hashes, used for HMAC signature verification

## Database Schema

Key tables (defined in `src/shared/database/schema.ts`):

### Core Configuration
| Table | Purpose |
|-------|---------|
| `guild_config` | Server-wide settings for all features |

### Welcome & Verification
| Table | Purpose |
|-------|---------|
| `welcome_trigger` | Role-based welcome message triggers |
| `welcome_config` | Welcome system configuration |
| `message_template` | Reusable message templates |
| `user_join` | Track joins/verification status |
| `verification_message_rule` | Role-specific verification messages |
| `verification_role_message` | Profile-based verification messages |

### Leveling & Boosts
| Table | Purpose |
|-------|---------|
| `level_profile` | User XP and levels per guild |
| `level_reward` | Role rewards at specific levels |
| `user_boost` | Track server boost status and roles |
| `boost_log` | Boost event history |

### Role Management
| Table | Purpose |
|-------|---------|
| `role_action` | Automated actions on role changes |
| `scheduled_role_action` | Delayed role actions |
| `reaction_role_message` | Reaction role configurations |
| `reaction_role` | Individual reaction-role mappings |

### Events & Scheduling
| Table | Purpose |
|-------|---------|
| `event` | Server events with RSVP and scheduling |
| `event_rsvp` | Event RSVP tracking (yes/no/maybe/waitlist) |
| `event_reminder` | User reminder preferences |
| `event_template` | Reusable event templates |
| `event_poll_settings` | Server-wide event/poll settings |
| `user_timezone` | User timezone preferences |

### Polls
| Table | Purpose |
|-------|---------|
| `poll` | Polls (standard, time, anonymous) |
| `poll_option` | Poll choices/options |
| `poll_vote` | User votes on polls (hashed for anonymous) |
| `poll_template` | Reusable poll templates |

### Webhooks & API
| Table | Purpose |
|-------|---------|
| `webhook_endpoint` | Outgoing webhook configurations |
| `webhook_delivery` | Webhook delivery logs |
| `api_key` | API key storage (SHA-256 hashed) |

### Moderation & Logging
| Table | Purpose |
|-------|---------|
| `moderation_case` | Moderation action cases |
| `moderation_settings` | Server moderation configuration |
| `action_log` | Audit trail of executed actions |
| `message_activity` | Analytics data for message heatmaps |

### Other Features
| Table | Purpose |
|-------|---------|
| `birthday_config` | Birthday announcement settings |
| `birthday_entry` | User birthday information |
| `birthday_log` | Birthday celebration history |
| `message_alias` | Auto-responder trigger words and responses |
| `command_config` | Per-command configuration |
| `discord_user_cache` | Cached Discord user information |
| `guild_growth` | Server growth analytics |

### Notifications
| Table | Purpose |
|-------|---------|
| `notification_event` | System notification events |
| `notification_delivery` | Notification delivery tracking |
| `notification_user_state` | Per-user notification state |
| `notification_user_cursor` | User notification read positions |
| `notification_preference` | User notification preferences |

## Webhook Implementation

Webhooks provide real-time event notifications to external systems.

### Supported Events
- `event.created`, `event.updated`, `event.deleted`, `event.started`
- `rsvp.yes`, `rsvp.no`, `rsvp.maybe`, `rsvp.waitlist`
- `poll.created`, `poll.voted`, `poll.closed`

### Security Features
- **HTTPS Only**: HTTP URLs are rejected
- **SSRF Protection**: Private IP ranges blocked (localhost, 10.x, 172.16-31.x, 192.168.x)
- **HMAC Signatures**: Optional secret for payload verification
- **Auto-Disable**: Webhooks disabled after 10 consecutive failures

### Webhook Service
Location: `src/bot/services/webhook-service.ts`

```typescript
// Trigger webhook for event
await webhookService.triggerEvent(guildId, 'event.created', {
    eventId: created.id,
    title: created.title,
    // ... event data
});
```

### Payload Format
```json
{
  "event": "event.created",
  "timestamp": "2026-02-11T12:00:00.000Z",
  "guildId": "123456789",
  "data": { /* event-specific data */ }
}
```

### Signature Verification
```typescript
const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(payload))
    .digest('hex');
// Compare to X-Webhook-Signature header
```

## Common Tasks

### Adding a New Bot Command
1. Create file in `src/bot/commands/{name}.ts`
2. Export a `Command` object with `data` (SlashCommandBuilder) and `execute`
3. Run `npm run build` to verify TypeScript compiles
4. Run `npm run deploy` to register the command with Discord
5. Restart bot (hot reload will pick it up automatically in dev)

### Command Categories

**General Commands**: `/ping`, `/info`, `/moveme`

**Leveling Commands**: `/rank`, `/profile`, `/leaderboard`, `/top`, `/setxp`, `/setlevel`

**Info Commands**: `/user`, `/avatar`, `/server`, `/roles`, `/dashboard`

**Event Commands**:
- `/event create` - Create a new event
- `/event list` - List upcoming events
- `/event info [id]` - Get event details
- `/event edit [id]` - Edit an event
- `/event cancel [id]` - Cancel an event
- `/rsvp [event] [status]` - RSVP to an event
- `/reminder [event] [minutes]` - Set a reminder

**Poll Commands**:
- `/poll create` - Create a standard poll
- `/poll create time` - Create a time poll
- `/poll close [id]` - Close a poll early
- `/poll results [id]` - View poll results

**Birthday Commands**: `/birthday set`, `/birthday remove`, `/birthday view`, `/birthday list`, `/birthday next`, `/birthday stats`, `/birthday admin-set`, `/birthday admin-remove`, `/birthday test`

**Moderation Commands**: 
- Warnings: `/warn add`, `/warn remove`, `/warn list`
- Mutes: `/mute text`, `/mute voice`, `/unmute text`, `/unmute voice`
- Timeouts: `/timeout`, `/untimeout`
- Kicks: `/kick`, `/vkick`
- Bans: `/ban`, `/unban`
- Utility: `/clear`, `/cases`, `/move`, `/lock`, `/unlock`, `/slowmode`, `/setnick`

**Role Management**: `/role give`, `/role remove`

**Reaction Roles**: `/reactionrole create`, `/reactionrole add`, `/reactionrole remove`, `/reactionrole list`, `/reactionrole delete`

**Admin/Setup**: `/setup`, `/config`, `/welcome`, `/verify`, `/boost`, `/reactionrole`

### Adding a New Dashboard Page
1. Create folder in `src/dashboard/app/dashboard/[guildId]/{feature}/`
2. Add `page.tsx` with the component
3. Add API routes in `src/dashboard/app/api/guilds/[guildId]/{feature}/`
4. Update navigation in `src/dashboard/lib/search/dashboard-nav.ts` if needed

### Adding Database Fields
1. **⚠️ BACKUP FIRST**: Run `npm run db:backup` to create a backup
2. Update `src/shared/database/schema.ts`
3. Run `npm run db:push` to apply changes
4. Update related services and types

### Database Backup & Restore

**Create a backup:**
```bash
npm run cli -- backup
```

**Restore from backup:**
```bash
npm run cli -- restore          # Interactive restore process
```

**Safe deployment (with automatic backup and rollback):**
```bash
npm run cli -- update         # Backs up, pulls code, migrates, and builds
```

Backups are stored in `./backups/` with a retention policy of 10 most recent backups.

### Adding New API Endpoints
1. Create route file: `src/dashboard/app/api/guilds/[guildId]/{endpoint}/route.ts`
2. Export HTTP method handlers (GET, POST, PATCH, DELETE)
3. Validate input with Zod
4. Return JSON responses

## Deployment

### Docker (Recommended for Production)
We use a robust CLI to handle deployments, which manages docker-compose under the hood.
```bash
# First-time build and deploy
npm run cli -- deploy

# Update safely (backup + git pull + rebuild + auto-rollback on failure)
npm run cli -- update
```

The Dockerfile uses multi-stage builds:
- `builder`: Compiles TypeScript and builds Next.js
- `runner`: Production image with PM2

### Manual Deployment
1. Run `npm run build` to compile bot
2. Run `npm run dashboard:build` to build dashboard
3. Copy `dist/`, `src/dashboard/.next/`, and dependencies to server
4. Run `pm2-runtime start ecosystem.config.js`

## Troubleshooting

### Bot won't start
- Check `DISCORD_TOKEN` is set correctly
- Verify all required intents are enabled in Discord Developer Portal
- Check logs in `logs/` directory

### Dashboard auth issues
- Verify `NEXTAUTH_SECRET` is set
- Check `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` match
- Ensure redirect URI in Discord app matches `NEXTAUTH_URL`

### Database errors
- Run `npm run db:push` to update schema
- Check `DATABASE_URL` format (should be `postgresql://...`)

## Useful Resources

- [Discord.js Documentation](https://discord.js.org/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [NextAuth.js](https://next-auth.js.org/)
- [shadcn/ui](https://ui.shadcn.com/)
