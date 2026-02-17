# ΙΧΘΥΣ (Ixoye) Discord Bot & Dashboard

A powerful, scalable, and feature-rich Discord bot with a comprehensive web dashboard for community management. Built with modern web technologies to ensure performance, reliability, and ease of use.

## 🚀 Features

### Modular Architecture
ΙΧΘΥΣ features a **flexible module system** that allows server administrators to enable/disable features per-guild. Each module is self-contained with:
- **Runtime Command Guards**: Commands are automatically protected when their module is disabled
- **Resource Authorization**: Cross-module access control and ownership validation
- **Policy-Based Execution**: Centralized permission and authorization checks
- **Module Lifecycle Management**: Full enable/disable/configure workflow through dashboard or commands

### Core Modules
- **📊 Analytics**: Visualize server growth, member retention, module usage, message activity heatmaps, and more with interactive charts.
- **👋 Welcome System**: Customizable welcome messages (text & embed) with role-based triggers, placeholder support, and image generation.
- **🛡️ Verification**: Automated verification tracking, grace periods, and auto-kick for unverified members to keep your server safe.
- **🚀 Boost Management**: Track server boosts, reward boosters with roles, and send custom thank-you messages.
- **⭐ Leveling System**: XP tracking for text and voice, customizable level-up messages, leaderboards, and role rewards.
- **🤖 Role Actions**: Automate actions (DM, Kick, Log) when members gain or lose specific roles.
<<<<<<< HEAD
- **🎉 Events**: Create and manage server events with RSVP tracking, reminders, templates, and optional Discord Event mirroring.
- **📊 Polls**: Interactive polls with multiple choice, ranked choice, and approval voting, plus templates and scheduled posting.
- **🎂 Birthdays**: Track member birthdays with automated announcements and optional role assignments.
- **📝 Message Aliases**: Auto-responder system with trigger words and custom responses.
- **🪝 Webhooks**: Managed webhook system for event notifications and channel integrations.
- **🔔 Notifications**: In-dashboard notification system with preferences and delivery tracking.
- **🛠️ Moderation**: Comprehensive mod tools including warns, mutes, timeouts, kicks, bans, and audit logging.
=======
- **🎂 Birthdays**: Automatic birthday announcements with timezone support and age calculation.
- **📅 Events**: Create and manage server events with RSVP tracking, recurring schedules, and role restrictions.
- **📊 Polls**: Standard polls, time polls (When2meet-style), and anonymous voting.
- **🎭 Reaction Roles**: Self-assignable roles via reactions, buttons, or dropdowns.
- **🔧 Moderation**: Warnings, mutes, kicks, bans, timeouts, and case tracking.
- **📝 Message Aliases**: Auto-responder system with custom triggers.

### Integration & API
- **🔗 Webhooks**: Receive real-time event notifications via HTTP POST requests with HMAC signature verification and encryption at rest.
- **🔑 API Keys**: Programmatic access to your server data with granular permissions and secure hash storage.
- **🔔 Notifications**: In-app notification stream for operational events and user preferences.

### Infrastructure
- **🚀 Performance**: Optional Redis-backed distributed rate limiting for multi-instance deployments with automatic in-memory fallback.
- **🔒 Security**: AES-256-GCM encryption for webhook secrets at rest, SSRF protection with DNS validation, and fail-fast secret validation.
>>>>>>> d03121e24f4f489ccf5801b927664547d11c622d

### Tech Stack
- **Bot**: [Discord.js](https://discord.js.org/) v14, TypeScript, [Bun](https://bun.sh/) 1.0+
- **Dashboard**: [Next.js](https://nextjs.org/) 16 (App Router), [React](https://react.dev/) 19, [Tailwind CSS](https://tailwindcss.com/) 4
- **Database**: [PostgreSQL 17](https://www.postgresql.org/) with [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication**: [NextAuth.js](https://next-auth.js.org/) v4 with Discord OAuth2
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/), [Lucide Icons](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/)
- **Process Management**: [PM2](https://pm2.keymetrics.io/) for production deployment

## 📂 Documentation

- **[Setup Guide](docs/SETUP.md)**: How to install, configure, and run the bot locally or in production.
- **[Dashboard Guide](docs/DASHBOARD.md)**: A walkthrough of the web dashboard features and configuration.
- **[Commands Reference](docs/COMMANDS.md)**: Complete npm and slash command catalog with options and examples.
- **[Module Docs](docs/MODULES.md)**: Deep-dive pages for each module and subsystem.
<<<<<<< HEAD
- **[Module Lifecycle](docs/modules/MODULE_LIFECYCLE.md)**: How to enable, disable, and manage modules per-guild.
- **[Agent Guide](AGENTS.md)**: Essential information for AI coding agents working on this project.
=======
>>>>>>> d03121e24f4f489ccf5801b927664547d11c622d

## 🛠️ Quick Start

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/ixoye-bot.git
    cd ixoye-bot
    ```

2.  **Install dependencies**
    ```bash
    bun install
    ```

3.  **Setup Environment**
    Copy `.env.example` to `.env` and fill in your Discord and NextAuth credentials.
    ```bash
    cp .env.example .env
    ```

4.  **Apply Database Migrations**
    ```bash
    bun run db:migrate
    ```

5.  **Deploy Commands to Discord**
    ```bash
    bun run deploy
    ```

6.  **Run Development**
    ```bash
    # Run both bot and dashboard
    bun run dev:all

    # Or run separately:
    # bun run dev            # Bot only
    # bun run dashboard:dev  # Dashboard only (http://localhost:3000)
    ```

## 🐳 Docker

Run with Docker Compose (includes Postgres + scheduled `pg_dump` backups):

```bash
# Development with hot reload
docker-compose -f docker-compose.dev.yml up --watch

# Production
docker-compose up -d
```

## 💾 Database Backups

The project includes automatic backup functionality:

```bash
# Manual backup
bun run db:backup

# List backups
bun run db:backup:list

# Restore from backup
bun run db:restore

# Safe deployment with automatic backup
bun run deploy:safe
```

When running in Docker, backups are handled by the `ixoye-pg-backup` sidecar using `BACKUP_INTERVAL_SECONDS` and `BACKUP_RETENTION_COUNT`.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.
