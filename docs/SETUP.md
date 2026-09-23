# Setup Guide

This guide walks you through setting up Ichthys Discord Bot and Dashboard for self-hosting.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start (Docker)](#quick-start-docker)
- [Manual Setup](#manual-setup)
- [Discord Application Setup](#discord-application-setup)
- [First-Time Configuration](#first-time-configuration)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 22+ | For manual setup |
| npm | 11+ | Comes with Node.js |
| PostgreSQL | 17 | For database |
| Docker | 24+ | For Docker setup (optional) |
| Discord Bot Token | - | From Discord Developer Portal |

---

## Quick Start (Docker)

Docker is the recommended approach for production deployment.

### 1. Clone the Repository

```bash
git clone https://github.com/yehoshu1/ichthys.git
cd ichthys
```

### 2. Configure Environment

Copy the example environment file and edit it:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Required - Discord credentials
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here

# Required - Dashboard
NEXTAUTH_URL=http://localhost:4002
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Required - Database
DATABASE_URL=postgresql://ixoye:your_secure_password@postgres:5432/ixoye
POSTGRES_PASSWORD=your_secure_password

# Recommended - URLs
DASHBOARD_URL=http://localhost:4002
DOMAIN=bot.example.com

# Optional - Security
METRICS_TOKEN=$(openssl rand -hex 32)
WEBHOOK_SECRET_ENCRYPTION_KEY=$(openssl rand -hex 16)
ANONYMIZE_SECRET=$(openssl rand -hex 16)
```

### 3. Start the Services

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 17** - Database
- **Ixoye App** - Bot + Dashboard (PM2 managed)

### 4. Initialize the Database

```bash
docker compose exec ixoye npm run db:push
```

For production, use migrations instead:

```bash
docker compose exec ixoye npm run db:migrate
```

### 5. Deploy Discord Commands

```bash
docker compose exec ixoye npm run deploy
```

### 6. Access the Dashboard

Open http://localhost:4002 in your browser and click "Sign in with Discord" to connect your account.

---

## Manual Setup

For development or if you prefer not to use Docker.

### 1. Install Dependencies

```bash
git clone https://github.com/yehoshu1/ichthys.git
cd ichthys
npm install
```

### 2. Set Up PostgreSQL

Create a database:

```bash
sudo -u postgres psql
CREATE DATABASE ixoye;
CREATE USER ixoye WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE ixoye TO ixoye;
\q
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values (see Docker section above)
```

### 4. Initialize Database

```bash
npm run db:push
```

### 5. Deploy Commands

```bash
npm run deploy
```

### 6. Start the Application

For development (hot reload):

```bash
npm run dev:all
```

For production:

```bash
npm run build
npm run dashboard:build
npm start
```

Or use PM2:

```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

---

## Discord Application Setup

### 1. Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Give it a name (e.g., "My Server Bot")

### 2. Create the Bot

1. Click "Bot" in the left sidebar
2. Click "Add Bot"
3. Under "Token", click "Reset Token" and copy it
4. Enable these **Privileged Gateway Intents**:
   - Server Members Intent
   - Message Content Intent

### 3. Get OAuth2 Credentials

1. Click "OAuth2" -> "URL Generator"
2. Select scopes: `identify`, `guilds`
3. Select bot permissions (choose based on your needs)
4. Copy the "Client ID" and "Client Secret"

### 4. Set Redirect URI

1. Click "OAuth2" -> "General"
2. Add redirect URI: `http://localhost:4002/api/auth/callback/discord`
3. For production: `https://yourdomain.com/api/auth/callback/discord`

### 5. Invite the Bot to Your Server

Use the OAuth2 URL from step 3 with `bot` scope added, or use this format:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=0&scope=bot%20applications.commands
```

---

## First-Time Configuration

### Using the Dashboard

1. Connect your Discord account via OAuth
2. Authorize access to the servers you manage
3. Select a server from the dashboard
4. Configure features per server

### Using Slash Commands

Some features can be configured via Discord commands:

```
/setup          - Initial server setup
/config         - View/modify configuration
/welcome        - Configure welcome system
/verify         - Configure verification
/boost          - Configure boost management
```

---

## Updating Safely

### With Docker (Recommended)

```bash
npm run cli -- update
```

Or manually:

```bash
# 1. Backup database
docker compose exec ixoye npm run db:backup

# 2. Pull latest code
git pull

# 3. Rebuild and restart
docker compose up -d --build

# 4. Run any pending migrations
docker compose exec ixoye npm run db:migrate
```

### Manual Update

```bash
# 1. Backup
npm run db:backup

# 2. Update code
git pull

# 3. Install dependencies
npm install

# 4. Run migrations
npm run db:migrate

# 5. Rebuild
npm run build
npm run dashboard:build

# 6. Restart
pm2 restart all
```

---

## Backup & Restore

### Create Backup

```bash
# Docker
docker compose exec ixoye npm run db:backup

# Manual
npm run db:backup
```

### Restore from Backup

```bash
# List available backups
npm run db:backup:list

# Restore (interactive)
npm run db:restore

# Restore specific file
npm run db:restore ./backups/ixoye-2026-01-15T12-00-00Z.dump
```

### Automated Backups

Docker compose includes automated daily backups via the `ixoye-pg-backup` service.

Configure with environment variables:
- `BACKUP_INTERVAL_SECONDS` - How often to backup (default: 86400 = daily)
- `BACKUP_RETENTION_COUNT` - How many backups to keep (default: 10)

---

## Troubleshooting

### Bot Doesn't Start

**Check logs:**
```bash
# Docker
docker compose logs ixoye

# Manual
cat logs/bot.log
```

**Common causes:**
- Invalid `DISCORD_TOKEN`
- Missing required environment variables
- Database connection failure

### Dashboard Shows "Not Connected"

1. Ensure `NEXTAUTH_URL` matches your actual URL
2. Clear browser cookies and try again
3. Check that Discord OAuth redirect URI matches

### Database Connection Errors

1. Verify PostgreSQL is running
2. Check `DATABASE_URL` format: `postgresql://user:pass@host:port/dbname`
3. For Docker, ensure `POSTGRES_HOST=postgres`

### Commands Not Appearing

1. Wait up to 1 hour for global command deployment
2. For instant testing, use `GUILD_ID` during deployment
3. Check the bot has "Applications Commands" permission

### Permission Errors

Ensure the bot has these permissions in your server:
- Send Messages
- Manage Roles (for role-based features)
- Manage Channels (for auto-channel features)
- Kick Members (for moderation)
- Ban Members (for moderation)
