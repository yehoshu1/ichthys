# ΙΧΘΥΣ (Ichthys) Discord Bot & Dashboard

A powerful, production-ready Discord bot with a comprehensive web dashboard for community management. Built with modern web technologies to ensure performance, reliability, and ease of use.

## Features

### Core Modules
- **Analytics Dashboard**: Visualize server growth, member retention, module usage, and message activity heatmaps with interactive charts.
- **Welcome System**: Customizable welcome messages (text & embed) with role-based triggers, image generation, and placeholder support.
- **Verification**: Automated verification tracking with profile-based messages, grace periods, and auto-kick for unverified members.
- **Boost Management**: Track server boosts, reward boosters with custom roles, and send personalized thank-you messages.
- **Leveling System**: Dual XP tracking (text & voice), customizable level-up messages, leaderboards, and role rewards at specific levels.
- **Role Actions**: Automate actions (DM, Message, Kick, Log) when members gain or lose specific roles with optional delays.
- **Birthdays**: Automatic birthday announcements with timezone support, age calculation, and optional birthday roles.
- **Events**: Create and manage server events with RSVP tracking (Yes/No/Maybe/Waitlist), recurring schedules, reminders, and role restrictions.
- **Polls**: Standard polls, time polls (When2meet-style), and anonymous voting with template support.
- **Moderation**: Warnings, text/voice mutes, kicks, bans, timeouts, message cleanup, and comprehensive case tracking.
- **Message Aliases**: Auto-responder system with custom triggers and responses.

### Integration & API
- **Webhooks**: Real-time event notifications via HTTP POST with HMAC signature verification, automatic retry, and SSRF protection.
- **API Keys**: Programmatic access to server data with granular permissions (read/write/delete) and SHA-256 hash storage.
- **Notifications**: In-app notification stream for operational events with user preferences and read tracking.

### Infrastructure
- **Performance**: PM2 process management, automatic in-memory rate limiting with optional Redis backend.
- **Security**: HTTPS-only webhooks, CSP headers, CSRF protection with proxy support, encrypted secrets at rest.
- **Deployment**: Docker Compose setup with PostgreSQL 17, automated database backups, and health checks.

### Tech Stack
- **Bot**: [Discord.js](https://discord.js.org/) v14, TypeScript, Node.js 22
- **Dashboard**: [Next.js](https://nextjs.org/) 16 (App Router), React 19, [Tailwind CSS](https://tailwindcss.com/) 4
- **Database**: [PostgreSQL 17](https://www.postgresql.org/) with [Drizzle ORM](https://orm.drizzle.team/)
- **Auth**: [NextAuth.js](https://next-auth.js.org/) v4 with Discord OAuth2
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/), [Lucide Icons](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/) for analytics visualization
- **Process Manager**: [PM2](https://pm2.keymetrics.io/) for production deployment

## Quick Start (Docker - Recommended)

The easiest way to get started is with Docker Compose. This sets up the bot, dashboard, and PostgreSQL database automatically.

### Prerequisites
- Docker & Docker Compose installed
- A Discord Bot Token and OAuth2 credentials ([create an app](https://discord.com/developers/applications))

### 1. Clone and Configure

```bash
git clone https://github.com/yehoshu1/ichthys.git
cd ichthys

cp .env.example .env
# Edit .env with your Discord credentials and database password
```

### 2. Start the Application

```bash
docker compose up -d
```

### 3. Initialize the Database

```bash
docker compose exec ixoye npm run db:push
```

For production, use migrations instead:

```bash
docker compose exec ixoye npm run db:migrate
```

### 4. Deploy Discord Commands

```bash
docker compose exec ixoye npm run deploy
```

### 5. Access the Dashboard

Open **http://localhost:4002** in your browser and click **"Sign in with Discord"** to connect your account.

### 6. Add the Bot to Your Server

- Use the OAuth2 URL generator in the Discord Developer Portal
- Select `bot` and `applications.commands` scopes
- Grant the necessary permissions

---

## Alternative: Manual Setup (Without Docker)

### Prerequisites
- Node.js 22+ and npm 11+
- PostgreSQL 17 running locally or on a server

### Steps

```bash
git clone https://github.com/yehoshu1/ichthys.git
cd ichthys
npm install --legacy-peer-deps

cp .env.example .env
# Edit .env with your credentials

npm run db:push
npm run deploy
npm run dev:all
```

The dashboard will be available at **http://localhost:4002**.

---

## Updating Safely

We provide a safe update command that automatically backs up your database, pulls the latest code, and rolls back if anything fails:

```bash
npm run cli -- update
```

For Docker deployments, this handles everything including rebuilding containers.

---

## Configuration

The bot is configured via environment variables. Copy `.env.example` to `.env` and edit:

### Required Variables

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Your bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Your application's client ID |
| `DISCORD_CLIENT_SECRET` | Your application's client secret |
| `DATABASE_URL` | PostgreSQL connection string |
| `POSTGRES_HOST` | Database host |
| `POSTGRES_PORT` | Database port |
| `POSTGRES_DB` | Database name |
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |
| `NEXTAUTH_URL` | URL where the dashboard is hosted |
| `NEXTAUTH_SECRET` | Random secret for session encryption |

### Optional Variables

| Variable | Description |
|----------|-------------|
| `DASHBOARD_URL` | Public URL for the dashboard (for `/dashboard` command) |
| `DOMAIN` | Domain name (for Docker/Traefik routing) |
| `METRICS_TOKEN` | Token to protect health/metrics endpoints |
| `WEBHOOK_SECRET_ENCRYPTION_KEY` | Encrypts webhook secrets (min 16 chars) |
| `ANONYMIZE_SECRET` | Anonymizes poll votes (min 16 chars) |

See `.env.example` for all configuration options with explanations.

---

## Security Best Practices

1. **Never commit your `.env` file** - It's in `.gitignore` for a reason
2. **Use strong passwords** for PostgreSQL - Don't use weak defaults
3. **Enable HTTPS** - Use a reverse proxy (nginx, Traefik, Caddy) with TLS
4. **Protect health endpoints** - Set `METRICS_TOKEN` in production
5. **Keep secrets encrypted** - Use `WEBHOOK_SECRET_ENCRYPTION_KEY` and `ANONYMIZE_SECRET`
6. **Regular backups** - Automated backups are included with Docker

---

## Documentation

- **[Setup Guide](docs/SETUP.md)** - Detailed installation instructions
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Updating Guide](docs/UPDATING.md)** - Safe update procedures
- **[Security Policy](SECURITY.md)** - How to report vulnerabilities
- **In-Dashboard Docs** - Available at `/docs` when the dashboard is running

---

## Available Scripts

```bash
# Bot
npm run dev              # Start bot with hot reload
npm run build            # Compile TypeScript
npm start                # Run compiled bot (production)
npm run deploy           # Deploy slash commands to Discord

# Dashboard
npm run dashboard:dev    # Start Next.js dev server
npm run dashboard:build  # Build for production
npm run dashboard:start  # Start production server

# Combined
npm run dev:all          # Run both bot and dashboard

# Database
npm run db:push          # Push schema changes (dev)
npm run db:migrate       # Run migrations (production)
npm run db:backup        # Create backup
npm run db:restore       # Restore from backup

# Docker
docker compose build     # Build images
docker compose up -d     # Start services
docker compose down      # Stop services

# CLI
npm run cli -- deploy    # Deploy with Docker
npm run cli -- update    # Safe update with backup
npm run cli -- backup    # Manual backup
npm run cli -- restore   # Restore from backup
```

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Branch structure:
- `main` - Production-ready code
- `feature/*` - New features
- `fix/*` - Bug fixes
- `chore/*` - Maintenance tasks
- `refactor/*` - Code refactoring

---

## License

This project is licensed under the [GNU GPL-3.0 License](LICENSE).

---

## Acknowledgments

- Built with [Discord.js](https://discord.js.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
- Database ORM: [Drizzle](https://orm.drizzle.team/)

---

**Made with for Discord communities**
