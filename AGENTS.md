# ΙΧΘΥΣ (Ixoye) Discord Bot & Dashboard - Agent Guide

This document provides essential information for AI coding agents working on the ΙΧΘΥΣ project.

## Project Overview

ΙΧΘΥΣ is a feature-rich Discord bot with a comprehensive web dashboard for community management. It provides welcome messages, verification tracking, boost management, leveling system, and role-based actions.

**Key Features:**
- **Welcome System**: Role-based message triggers with customizable templates
- **Verification**: Auto-kick unverified members after grace period
- **Boost Management**: Track server boosts and reward boosters
- **Leveling System**: XP tracking for text and voice with role rewards
- **Role Actions**: Automate actions (DM, Kick, Log) when roles change
- **Analytics Dashboard**: Visualize server growth and activity

## Technology Stack

| Component | Technology |
|-----------|------------|
| Bot | Discord.js v14, TypeScript, Bun 1.0+ |
| Dashboard | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Database | SQLite with Drizzle ORM |
| Authentication | NextAuth.js v4 with Discord OAuth2 |
| Logging | Winston with daily rotation |
| Process Manager | PM2 |

## Project Structure

```
ixoye/
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
│   └── DASHBOARD.md           # Dashboard user guide
├── drizzle/                    # Database migrations (generated)
├── data/                       # SQLite database files (runtime)
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
bun run dev                    # Start bot with hot reload
bun run dashboard:dev          # Start Next.js dev server
bun run dev:all                # Run both bot and dashboard concurrently

# Build
bun run build                  # Compile bot to dist/ (uses tsconfig.bot.json)
bun run dashboard:build        # Build Next.js for production

# Production
bun start                      # Run compiled bot from dist/
bun run dashboard:start        # Start Next.js production server

# Database
bun run db:generate            # Generate Drizzle migrations
bun run db:push                # Push schema changes to database
bun run db:studio              # Open Drizzle Studio GUI

# Deployment
bun run deploy                 # Deploy slash commands to Discord
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
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32

# Database
DATABASE_URL=file:./data/ixoye.db

# Optional
LOG_LEVEL=info                    # debug, info, warn, error
NODE_ENV=development              # development, production
PORT=3000                         # Dashboard port
GUILD_ID=your_test_guild_id       # For testing slash commands
```

## Security Considerations

1. **Never commit `.env` file** - It's in `.gitignore` for a reason
2. **Discord Token Security**: Regenerate immediately if exposed
3. **OAuth Scopes**: Dashboard only requests `identify` and `guilds` scopes
4. **API Authorization**: Dashboard API routes check user has access to requested guild
5. **SQL Injection**: Protected by Drizzle ORM parameterized queries
6. **XSS Protection**: React's built-in escaping, plus careful handling of Discord content

## Database Schema

Key tables (defined in `src/shared/database/schema.ts`):

| Table | Purpose |
|-------|---------|
| `guild_config` | Server-wide settings for all features |
| `welcome_trigger` | Role-based welcome message triggers |
| `message_template` | Reusable message templates |
| `user_join` | Track joins/verification status |
| `user_boost` | Track server boost status and roles |
| `level_profile` | User XP and levels per guild |
| `level_reward` | Role rewards at specific levels |
| `role_action` | Automated actions on role changes |
| `action_log` | Audit trail of executed actions |
| `message_activity` | Analytics data for message heatmaps |
| `message_alias` | Auto-responder trigger words and responses |

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

**Birthday Commands**: `/birthday set`, `/birthday remove`, `/birthday view`, `/birthday list`, `/birthday next`, `/birthday stats`, `/birthday admin-set`, `/birthday admin-remove`, `/birthday test`

**Moderation Commands**: 
- Warnings: `/warn add`, `/warn remove`, `/warn list`
- Mutes: `/mute text`, `/mute voice`, `/unmute text`, `/unmute voice`
- Timeouts: `/timeout`, `/untimeout`
- Kicks: `/kick`, `/vkick`
- Bans: `/ban`, `/unban`
- Utility: `/clear`, `/cases`, `/move`, `/lock`, `/unlock`, `/slowmode`, `/setnick`

**Role Management**: `/role give`, `/role remove`

**Admin/Setup**: `/setup`, `/config`, `/welcome`, `/verify`, `/boost`, `/reactionrole`

### Adding a New Dashboard Page
1. Create folder in `src/dashboard/app/dashboard/[guildId]/{feature}/`
2. Add `page.tsx` with the component
3. Add API routes in `src/dashboard/app/api/guilds/[guildId]/{feature}/`
4. Update navigation in guild layout if needed

### Adding Database Fields
1. **⚠️ BACKUP FIRST**: Run `npm run db:backup` to create a backup
2. Update `src/shared/database/schema.ts`
3. Run `npm run db:push` to apply changes
4. Update related services and types

### Database Backup & Restore

**Create a backup:**
```bash
npm run db:backup           # Creates timestamped backup
npm run db:backup:list      # List all available backups
```

**Restore from backup:**
```bash
npm run db:restore          # Restore from most recent backup
npm run db:restore:list     # List backups to choose from
npm run db:restore ixoye-2026-02-08T10-30-00.db  # Restore specific backup
```

**Safe deployment (with automatic backup):**
```bash
npm run deploy:safe         # Backs up, migrates, and builds
```

Backups are stored in `./backups/` with a retention policy of 10 most recent backups.

### Adding New API Endpoints
1. Create route file: `src/dashboard/app/api/guilds/[guildId]/{endpoint}/route.ts`
2. Export HTTP method handlers (GET, POST, PATCH, DELETE)
3. Validate input with Zod
4. Return JSON responses

## Deployment

### Docker (Recommended for Production)
```bash
# Build and run with docker-compose
docker-compose up -d
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
- Ensure `data/` directory exists and is writable
- Run `npm run db:push` to update schema
- Check `DATABASE_URL` format (should be `file:./data/ixoye.db`)

## Useful Resources

- [Discord.js Documentation](https://discord.js.org/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [NextAuth.js](https://next-auth.js.org/)
- [shadcn/ui](https://ui.shadcn.com/)
