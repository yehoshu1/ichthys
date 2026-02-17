# ΙΧΘΥΣ (Ixoye) Discord Bot & Dashboard

A powerful, production-ready Discord bot with a comprehensive web dashboard for community management. Built with modern web technologies to ensure performance, reliability, and ease of use.

> **Status**: ✅ Production Ready - Currently serving 2 guilds with all features operational.

## 🚀 Features

### Core Modules
- **📊 Analytics Dashboard**: Visualize server growth, member retention, module usage, and message activity heatmaps with interactive charts.
- **👋 Welcome System**: Customizable welcome messages (text & embed) with role-based triggers, image generation, and placeholder support.
- **🛡️ Verification**: Automated verification tracking with profile-based messages, grace periods, and auto-kick for unverified members.
- **🚀 Boost Management**: Track server boosts, reward boosters with custom roles, and send personalized thank-you messages.
- **⭐ Leveling System**: Dual XP tracking (text & voice), customizable level-up messages, leaderboards, and role rewards at specific levels.
- **🤖 Role Actions**: Automate actions (DM, Message, Kick, Log) when members gain or lose specific roles with optional delays.
- **🎂 Birthdays**: Automatic birthday announcements with timezone support, age calculation, and optional birthday roles.
- **📅 Events**: Create and manage server events with RSVP tracking (Yes/No/Maybe/Waitlist), recurring schedules, reminders, and role restrictions.
- **📊 Polls**: Standard polls, time polls (When2meet-style), and anonymous voting with template support.
- **🎭 Reaction Roles**: Self-assignable roles via reactions, buttons, or dropdown menus.
- **🔧 Moderation**: Warnings, text/voice mutes, kicks, bans, timeouts, message cleanup, and comprehensive case tracking.
- **📝 Message Aliases**: Auto-responder system with custom triggers and responses.

### Integration & API
- **🔗 Webhooks**: Real-time event notifications via HTTP POST with HMAC signature verification, automatic retry, and SSRF protection.
- **🔑 API Keys**: Programmatic access to server data with granular permissions (read/write/delete) and SHA-256 hash storage.
- **🔔 Notifications**: In-app notification stream for operational events with user preferences and read tracking.

### Infrastructure
- **🚀 Performance**: PM2 process management, Redis-backed distributed rate limiting (optional), automatic in-memory fallback.
- **🔒 Security**: HTTPS-only webhooks, CSP headers, CSRF protection with proxy support, encrypted secrets at rest.
- **🔄 Deployment**: Docker Compose setup with PostgreSQL 17, automated database backups, and health checks.

### Tech Stack
- **Bot**: [Discord.js](https://discord.js.org/) v14, TypeScript, Node.js 22
- **Dashboard**: [Next.js](https://nextjs.org/) 16 (App Router), React 19, [Tailwind CSS](https://tailwindcss.com/) 4
- **Database**: [PostgreSQL 17](https://www.postgresql.org/) with [Drizzle ORM](https://orm.drizzle.team/)
- **Auth**: [NextAuth.js](https://next-auth.js.org/) v4 with Discord OAuth2
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/), [Lucide Icons](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/) for analytics visualization
- **Process Manager**: [PM2](https://pm2.keymetrics.io/) for production deployment

## 📂 Documentation

- **[Setup Guide](docs/SETUP.md)**: How to install, configure, and run the bot locally or in production.
- **[Dashboard Guide](docs/DASHBOARD.md)**: A walkthrough of the web dashboard features and configuration.
- **[Commands Reference](docs/COMMANDS.md)**: Complete npm and slash command catalog with options and examples.
- **[Module Docs](docs/MODULES.md)**: Deep-dive pages for each module and subsystem.

## 🛠️ Quick Start

### Prerequisites
- Node.js 22+ (npm 11.9.0)
- PostgreSQL 17
- Discord Bot Token & OAuth2 credentials
- (Optional) Redis for distributed rate limiting

### Local Development

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yehoshu1/ixoye.git
    cd ixoye
    ```

2.  **Install dependencies**
    ```bash
    npm install --legacy-peer-deps
    ```

3.  **Setup Environment**
    Create `.env` file with your credentials:
    ```bash
    # Discord Bot Configuration
    DISCORD_TOKEN=your_bot_token
    DISCORD_CLIENT_ID=your_client_id
    DISCORD_CLIENT_SECRET=your_client_secret

    # NextAuth Configuration
    NEXTAUTH_URL=http://localhost:4002
    NEXTAUTH_SECRET=$(openssl rand -base64 32)

    # Database
    DATABASE_URL=postgresql://ixoye:password@localhost:5432/ixoye
    PG_SSL=false

    # Optional
    LOG_LEVEL=info
    PORT=4002
    DASHBOARD_URL=http://localhost:4002
    ```

4.  **Initialize Database**
    ```bash
    # Push schema to database
    npm run db:push

    # Or use migrations (recommended for production)
    npm run db:generate
    npm run db:migrate
    ```

5.  **Deploy Slash Commands**
    ```bash
    # Deploy to specific guild (instant, for testing)
    GUILD_ID=your_test_guild_id npm run deploy

    # Or deploy globally (takes up to 1 hour to propagate)
    npm run deploy
    ```

6.  **Run Development**
    ```bash
    # Run both bot and dashboard with hot reload
    npm run dev:all

    # Or run separately:
    npm run dev              # Bot only
    npm run dashboard:dev    # Dashboard only (http://localhost:4002)
    ```

## 🐳 Docker Deployment (Recommended)

The project includes a production-ready Docker setup with PostgreSQL, automated backups, and PM2 process management.

### Production Deployment

1.  **Configure environment variables** in `.env`:
    ```bash
    DISCORD_TOKEN=your_production_token
    DISCORD_CLIENT_ID=your_client_id
    DISCORD_CLIENT_SECRET=your_client_secret
    NEXTAUTH_URL=https://yourdomain.com
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    DATABASE_URL=postgresql://ixoye:change_me@postgres:5432/ixoye
    PG_SSL=false
    PORT=4002
    ```

2.  **Build and start services**:
    ```bash
    docker compose build
    docker compose up -d
    ```

3.  **Deploy slash commands** (inside container):
    ```bash
    docker exec ixoye-app node /app/scripts/deployCommands.js
    ```

4.  **Check logs**:
    ```bash
    docker logs ixoye-app -f
    ```

### Services Included
- **ixoye-app**: Bot + Dashboard (PM2 managed, port 4002)
- **ixoye-postgres**: PostgreSQL 17 database
- **ixoye-redis**: Optional Redis for rate limiting
- **ixoye-pg-backup**: Automated database backups (daily)

### Reverse Proxy Setup
If behind Cloudflare or nginx, the bot automatically detects `X-Forwarded-*` headers for proper origin validation.

## 💾 Database Management

### Backups

```bash
# Create manual backup (timestamped)
npm run db:backup

# List available backups
npm run db:backup:list

# Restore from most recent backup
npm run db:restore

# Restore specific backup
npm run db:restore ixoye-2026-02-17T10-30-00.db
```

**Docker:** Automated daily backups via `ixoye-pg-backup` container with configurable retention (default: 10 most recent).

### Schema Management

```bash
# Push schema changes directly (development)
npm run db:push

# Generate migration files (production)
npm run db:generate

# Open Drizzle Studio (GUI)
npm run db:studio
```

### Safe Deployment
```bash
# Backup + migrate + build in one command
npm run deploy:safe
```

## 🔧 Available Scripts

```bash
# Bot commands
npm run dev              # Start bot with hot reload
npm run build            # Compile TypeScript to dist/
npm start                # Run compiled bot (production)
npm run deploy           # Deploy slash commands to Discord

# Dashboard commands
npm run dashboard:dev    # Start Next.js dev server (port 4002)
npm run dashboard:build  # Build dashboard for production
npm run dashboard:start  # Start Next.js production server

# Combined
npm run dev:all          # Run both bot and dashboard

# Database
npm run db:push          # Push schema changes
npm run db:generate      # Generate migrations
npm run db:studio        # Open Drizzle Studio

# Docker
docker compose build     # Build images
docker compose up -d     # Start services
docker compose down      # Stop services
docker logs ixoye-app -f # View logs
```

## 📝 Recent Updates (v0.2.0)

### Fixed
- ✅ `/setup` command button interactions now fully functional
- ✅ Dashboard config saves no longer fail with validation errors
- ✅ Verification profile messages no longer send twice
- ✅ JSON serialization errors in verification embeds resolved
- ✅ PostgreSQL boolean comparisons fixed for verification stats
- ✅ Level data properly calculated from XP (115 profiles recalculated)
- ✅ CSRF protection now works behind Cloudflare proxy

### Added
- ✅ Setup command handlers for toggle buttons and selects
- ✅ Role and channel select menu support in component router
- ✅ Deduplication for verification profile messages
- ✅ Support for `X-Forwarded-*` headers in CSRF validation
- ✅ Command deployment script for production containers

### Changed
- ✅ Config validation schemas changed from `.strict()` to `.passthrough()`
- ✅ Port changed from 3000 to 4002 for dashboard
- ✅ `PG_SSL=false` required for local PostgreSQL connections

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Discord.js](https://discord.js.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)

---

**Made with ❤️ for Discord communities**
