---
title: "Setup and Installation"
description: "Install, configure, and run Ixoye for the first time."
---

This guide is the canonical setup reference for the current Ixoye codebase.

## Stack and Runtime Baseline

- Node.js: `22.x` recommended
- npm: `11.9.0` (declared in `package.json`)
- Database: PostgreSQL 17 (`DATABASE_URL=postgresql://...`)
- Bot framework: Discord.js v14
- Dashboard: Next.js 16 App Router

## Prerequisites

Install before running the project:

- Node.js and npm
- Git
- Discord Developer Portal access
- OpenSSL (for generating `NEXTAUTH_SECRET`)
- Docker (optional, for containerized dev/prod)

Verify local tools:

```bash
node -v
npm -v
```

## 1. Create and Configure Discord Application

1. Open <https://discord.com/developers/applications>.
2. Create or select your app.
3. In **Bot** tab:
- Generate/reset token and store as `DISCORD_TOKEN`.
- Enable privileged intents:
- `SERVER MEMBERS INTENT`
- `MESSAGE CONTENT INTENT`
4. In **OAuth2** tab:
- Copy `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`.
- Add redirect URI for local dashboard auth:
- `http://localhost:4002/api/auth/callback/discord`

## 2. Configure Environment Variables

Copy template:

```bash
cp .env.example .env
```

Generate auth secret:

```bash
openssl rand -base64 32
```

### Required Variables

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Bot token used by Discord client and some dashboard API routes. |
| `DISCORD_CLIENT_ID` | Yes | Discord app client ID for auth and command deploy. |
| `DISCORD_CLIENT_SECRET` | Yes | Discord app client secret for NextAuth provider. |
| `NEXTAUTH_SECRET` | Yes | Session/JWT signing secret for dashboard auth. |
| `NEXTAUTH_URL` | Yes | Base URL for auth callback handling. |
| `DATABASE_URL` | Yes | PostgreSQL DSN used by bot, dashboard, and Drizzle. |
| `POSTGRES_HOST` | Yes | PostgreSQL hostname (Docker service name in compose: `postgres`). |
| `POSTGRES_PORT` | Yes | PostgreSQL port (`5432`). |
| `POSTGRES_DB` | Yes | PostgreSQL database name. |
| `POSTGRES_USER` | Yes | PostgreSQL username. |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password. |
| `DASHBOARD_URL` | No | Base URL for the `/dashboard` command. Required for users to access the dashboard link. |
| `WEBHOOK_SECRET_ENCRYPTION_KEY` | Yes (webhook features) | Encrypts webhook secrets at rest (minimum 16 characters). |
| `ANONYMIZE_SECRET` | Yes (anonymous polls) | Secret for anonymizing user IDs in anonymous polls (minimum 16 characters). |
| `METRICS_TOKEN` | Optional (recommended in prod) | Bearer token required to access `GET /api/metrics` in production. |
| `REDIS_URL` | Optional (recommended in prod) | Enables distributed dashboard rate limiting/cache across multiple app instances. Requires `ioredis` package installed. |
| `DOMAIN` | Yes (for Docker/Traefik) | Base domain used by Traefik router to proxy web traffic in production deployments. |

### Common Local Values

```bash
NEXTAUTH_URL=http://localhost:4002
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=ixoye
POSTGRES_USER=ixoye
POSTGRES_PASSWORD=change_me
DATABASE_URL=postgresql://ixoye:change_me@localhost:5432/ixoye
NODE_ENV=development
LOG_LEVEL=info
WEBHOOK_SECRET_ENCRYPTION_KEY=replace_with_random_16plus_chars
ANONYMIZE_SECRET=replace_with_different_random_16plus_chars
METRICS_TOKEN=replace_with_random_metrics_token
REDIS_URL=redis://localhost:6379
DOMAIN=bot.example.com
```

When `REDIS_URL` is set, dashboard rate limiting attempts to use Redis (multi-instance safe). If Redis client support is unavailable or `REDIS_URL` is unset, it falls back to in-memory per-instance limits.

### Rate Limiting

The dashboard uses optional Redis-backed rate limiting for multi-instance deployments:

- **With Redis:** 
  1. Install the optional dependency: `npm install ioredis`
  2. Set `REDIS_URL` environment variable
  3. Rate limits are shared across all instances
  4. Add Redis service to docker-compose (already configured in dev/prod compose files)
  
- **Without Redis:** 
  - Falls back to in-memory LRU cache automatically
  - Each instance tracks limits independently (fine for single-instance deployments)

The rate limiting service logs warnings if Redis connection fails and automatically falls back to in-memory mode. Redis is loaded dynamically at runtime, so the application works without the `ioredis` package installed.

### Metrics Endpoint

- Route: `GET /api/metrics`
- Auth:
   - Production: requires `Authorization: Bearer <METRICS_TOKEN>`
   - Development: allowed without token when `METRICS_TOKEN` is unset
- Includes: process uptime, memory usage, DB pool metrics, rate-limit store stats, and Discord cache stats.

### Detailed Health Endpoint

- Route: `POST /api/health`
- Auth:
   - Production: requires `Authorization: Bearer <METRICS_TOKEN>`
   - Development: allowed without token when `METRICS_TOKEN` is unset
- Purpose: internal diagnostics with DB pool and memory details.

## 3. Install Dependencies

Clean install (recommended):

```bash
npm ci
```

If lockfile changes during development, run `npm ci` again.

## 4. Initialize Database

Apply migrations to local DB:

```bash
npm run db:migrate
```

Optional GUI:

```bash
npm run db:studio
```

## 5. Run Locally (Non-Docker)

Run bot + dashboard:

```bash
npm run dev:all
```

Run individually:

```bash
npm run dev
npm run dashboard:dev
```

Endpoints:

- Dashboard: <http://localhost:4002>
- Bot: no HTTP endpoint (Discord gateway client)

## 6. Docker Development

Start dev stack:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Tail logs:

```bash
docker compose -f docker-compose.dev.yml logs -f ixoye-dev
```

Stop:

```bash
docker compose -f docker-compose.dev.yml down
```

### Docker Dev Behavior Notes

- Dev image installs latest npm (`11.9.0`) in base stage.
- `scripts/dev-start.sh` checks lockfile hash and runs `npm ci` automatically when needed.
- Dashboard dev runs with webpack mode to avoid stale Turbopack chunk issues.
- `.next` build output is cleared on container start to prevent stale chunk references.

## 7. Build and Run for Production (Local Host)

Build bot:

```bash
npm run build
```

Build dashboard:

```bash
npm run dashboard:build
```

Run bot:

```bash
npm run start
```

Run dashboard:

```bash
npm run dashboard:start
```

## 8. Production Docker (Using Built-in CLI)

Build and deploy the application safely:

```bash
npm run cli -- deploy
```

Safely update the application (automatic backup, pull, build, rollback on failure):

```bash
npm run cli -- update
```

Read logs:

```bash
npm run cli -- logs
```

The production image uses PM2 runtime (`ecosystem.config.js`).

## 9. Command Deployment to Discord

When slash command definitions change, redeploy:

```bash
npm run deploy
```

Recommended before deploy:

- Ensure `DISCORD_CLIENT_ID` and `DISCORD_TOKEN` are correct.
- Use `GUILD_ID` in env for focused test registration workflows if your deploy script supports it.

## 10. Backup and Restore Operations

Create backup:

```bash
npm run cli -- backup
```

Restore (interactive):

```bash
npm run cli -- restore
```

Safe deployment wrapper (updates and backs up):

```bash
npm run cli -- update
```

## 11. Troubleshooting

## `npm ci` fails with lock mismatch

- Regenerate lockfile with current npm:

```bash
npx npm@11.9.0 install --package-lock-only
```

- Re-run:

```bash
npm ci
```

## Dashboard cannot resolve package modules in Docker dev

- Rebuild and restart dev service to refresh mounted dependencies:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

## Discord data endpoints return unauthorized/forbidden

- Re-authenticate dashboard session.
- Confirm user has `Manage Server` permission for target guild.
- Confirm bot token and OAuth credentials are valid.

## Slash commands not updating

- Run `npm run deploy`.
- Confirm target application and token values.

## NextAuth callback issues

- Ensure `NEXTAUTH_URL` matches the actual dashboard URL.
- Ensure Discord redirect URI exactly matches callback path.

## Documentation Map

The documentation files are built directly into the dashboard and can be accessed under `/docs`. The markdown source files are located in `src/dashboard/content/docs/`:

- Setup: `getting-started.md`
- Commands: `commands.md`
- Dashboard overview: `dashboard.md`
- Module deep-dives: `modules/`

## Dashboard Access

Users can access the dashboard in two ways:

1. **Direct URL**: Navigate to `{NEXTAUTH_URL}/dashboard/{guildId}`
2. **Discord Command**: Use `/dashboard` in the server

### Dashboard URL Configuration

The dashboard URL is configured via the `DASHBOARD_URL` environment variable:

```bash
DASHBOARD_URL=https://dashboard.example.com
```

#### When Configured

When `DASHBOARD_URL` is set, users can use the `/dashboard` command to get a link to the dashboard:
- Everyone can use the command
- The bot will reply with the dashboard URL for the current server

#### When Not Configured

If `DASHBOARD_URL` is not set, users will see:
> "Bot URL not set. Please contact an administrator to set up the URL."

Contact your bot administrator to have the `DASHBOARD_URL` environment variable configured.
