# Setup and Installation

This guide is the canonical setup reference for the current Ixoye codebase.

## Stack and Runtime Baseline

- Node.js: `22.x` recommended
- npm: `11.9.0` (declared in `package.json`)
- Database: SQLite (`DATABASE_URL=file:./data/ixoye.db` by default)
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
- `http://localhost:4000/api/auth/callback/discord`

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
| `DATABASE_URL` | Yes | SQLite DSN. Default local path is `file:./data/ixoye.db`. |
| `DASHBOARD_URL` | No | Base URL for the `/dashboard` command. Required for users to access the dashboard link. |

### Common Local Values

```env
NEXTAUTH_URL=http://localhost:4000
DATABASE_URL=file:./data/ixoye.db
NODE_ENV=development
LOG_LEVEL=info
```

## 3. Install Dependencies

Clean install (recommended):

```bash
npm ci
```

If lockfile changes during development, run `npm ci` again.

## 4. Initialize Database

Push schema to local DB:

```bash
npm run db:push
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

- Dashboard: <http://localhost:4000>
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

## 8. Production Docker

Build and run:

```bash
docker compose up -d --build
```

Read logs:

```bash
docker compose logs -f
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
npm run db:backup
```

List backups:

```bash
npm run db:backup:list
```

Restore:

```bash
npm run db:restore
```

List restore targets:

```bash
npm run db:restore:list
```

Safe deployment wrapper:

```bash
npm run deploy:safe
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

- Ensure `NEXTAUTH_URL` matches actual dashboard URL.
- Ensure Discord redirect URI exactly matches callback path.

## Documentation Map

- Setup: `docs/SETUP.md`
- Commands: `docs/COMMANDS.md`
- Dashboard overview: `docs/DASHBOARD.md`
- Module deep-dives: `docs/MODULES.md`

## Dashboard Access

Users can access the dashboard in two ways:

1. **Direct URL**: Navigate to `{NEXTAUTH_URL}/dashboard/{guildId}`
2. **Discord Command**: Use `/dashboard` in the server

### Dashboard URL Configuration

The dashboard URL is configured via the `DASHBOARD_URL` environment variable:

```env
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
