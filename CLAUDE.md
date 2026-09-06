# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **All development guidelines, branching rules, and conventions are in [AGENTS.md](./AGENTS.md). Read it before making any changes.**

## Project Overview

Ichthys is a full-stack Discord community management bot with a web dashboard. It's a TypeScript monorepo with two main processes: a Discord.js v14 bot and a Next.js 16 dashboard.

## Development Guidelines

See [AGENTS.md](./AGENTS.md) for all guidelines including branching, code style, naming conventions, and workflows.

## Common Commands

### Development
```bash
npm run dev           # Bot only (watch mode via tsx)
npm run dashboard:dev # Dashboard only (Next.js dev server on port 4002 by default)
npm run dev:all       # Both bot and dashboard concurrently
```

### Building
```bash
npm run build           # Compile bot TypeScript (tsconfig.bot.json)
npm run dashboard:build # Build Next.js dashboard
```

### Database
```bash
npm run db:push     # Push schema changes to the database
npm run db:generate # Generate migration files
npm run db:migrate  # Run pending migrations
npm run db:studio   # Open Drizzle Studio
npm run db:backup   # Backup database
npm run db:restore  # Restore database
```

### Validation & Testing
```bash
npm run typecheck  # TypeScript type checking
npm run lint       # ESLint
npm run test       # Vitest unit tests
npm run test -- --reporter=verbose path/to/test.ts  # Run a single test file
npm run validate   # Runs typecheck + lint + test + guards together
```

### Deployment
```bash
npm run deploy            # Deploy slash commands to Discord
npm run deploy:safe       # Backup + migrate + build (production deploy)
npm run guard:modules     # Validate module guard configurations
npm run guard:commands    # Validate command catalog
```

## Architecture

The codebase is split into three main areas:

### `src/bot/` — Discord Bot
- **Entry**: `src/bot/index.ts` — initializes cron jobs, loads commands/events dynamically, logs into Discord
- **`commands/`** — ~40 slash command implementations, each file exports a command definition and handler
- **`events/`** — Discord event handlers (message, member join/leave, reactions, voice state, etc.)
- **`jobs/`** — node-cron scheduled tasks (birthdays, analytics, moderation expiry, voice XP, notifications)
- **`services/`** — bot-specific business logic (guild config, polls, events)
- **`components/`** — Discord component interaction routers (buttons, dropdowns, modals)
- **TypeScript config**: `tsconfig.bot.json` (CommonJS output, excludes dashboard)

### `src/dashboard/` — Next.js Web Dashboard
- **App Router** at `src/dashboard/app/`
- Auth via NextAuth.js with Discord OAuth2 at `/api/auth/[...nextauth]/`
- Guild-scoped pages under `/dashboard/[guildId]/` for each feature module
- 50+ API routes under `/api/` for guild data, configuration, and operations
- **Port**: 4002 by default in local and production unless `PORT` overrides it
- **TypeScript config**: `tsconfig.json` (bundler resolution, Next.js plugin)

### `src/shared/` — Shared Code
- **`database/schema.ts`** — Drizzle ORM schema (single source of truth for all DB tables)
- **`database/client.ts`** — PostgreSQL connection pool
- **`modules/`** — Module registry: each feature (leveling, verification, etc.) is a "module" with enable/disable guards
- **`services/`** — Shared business logic used by both bot and dashboard
- **`notifications/`** — Operational notification system with read tracking
- **`rate-limit/`** — In-memory rate limiting with optional Redis backend
- **`utils/`** and **`constants/`** — Shared utilities and constants

## Module System

Features are organized as modules (leveling, verification, boosts, birthdays, events, polls, moderation, etc.). Each module can be enabled/disabled per guild. The `src/shared/modules/` system enforces guards — bot commands and dashboard API routes check module state before executing. When adding new features, register them in the module system.

## Key Configuration

- **Two tsconfigs**: `tsconfig.json` for the dashboard, `tsconfig.bot.json` for the bot
- **Path aliases**: `@` → dashboard src, `@shared` → `src/shared`, `@bot` → `src/bot`
- **Drizzle config**: `drizzle.config.ts` — schema at `src/shared/database/schema.ts`, migrations in `drizzle/`
- **PM2**: `ecosystem.config.js` — two processes: `ichthys-bot` (700MB limit) and `ichthys-dashboard` (900MB limit)
- **Dashboard port config**: `package.json` dashboard scripts (`PORT` env, default `4002`)

## Environment Variables

Copy `.env.example` to `.env`. Required at minimum:
- `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`
- `DATABASE_URL` and individual `POSTGRES_*` vars
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `DASHBOARD_URL`

Security-sensitive vars: `WEBHOOK_SECRET_ENCRYPTION_KEY` (AES-256-GCM), `ANONYMIZE_SECRET` (anonymous polls).

## Docker

```bash
docker compose -f docker-compose.dev.yml up   # Development
docker compose up                              # Production
```

Production compose includes PostgreSQL 17, automated backups, and health checks.
