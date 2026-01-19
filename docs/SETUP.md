# Setup & Installation Guide

This guide will help you set up the ΙΧΘΥΣ (Ixoye) bot and dashboard on your local machine or production server.

## Prerequisites

- **Node.js**: v18 or higher (v20+ recommended)
- **Discord Account**: To create an application in the Developer Portal.
- **Git**: For version control.

## 1. Discord Developer Portal

1.  Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2.  Click **New Application** and give it a name (e.g., "Ixoye").
3.  **Bot Tab**:
    - Click **Reset Token** to get your `DISCORD_TOKEN`. Copy it.
    - Enable **Privileged Gateway Intents**:
        - `PRESENCE INTENT`
        - `SERVER MEMBERS INTENT`
        - `MESSAGE CONTENT INTENT`
4.  **OAuth2 Tab**:
    - Get your `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`.
    - Add a **Redirect URI** for the dashboard:
        - Local: `http://localhost:3000/api/auth/callback/discord`
        - Production: `https://your-domain.com/api/auth/callback/discord`

## 2. Environment Configuration

Create a `.env` file in the root directory:

```env
# Discord Bot
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here

# NextAuth (Dashboard Auth)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_a_random_string_here

# Database
DATABASE_URL=file:./sqlite.db
```

> **Tip**: You can generate a random `NEXTAUTH_SECRET` using `openssl rand -base64 32` or any online generator.

## 3. Installation

Install the project dependencies:

```bash
npm install
```

## 4. Database Setup

We use Drizzle ORM to manage the SQLite database.

1.  **Push Schema**: Creates the database tables.
    ```bash
    npm run db:push
    ```
2.  **(Optional) Studio**: View and edit your database data in a browser.
    ```bash
    npm run db:studio
    ```

## 5. Running the Application

### Development
Run the bot and dashboard in separate terminals.

**Terminal 1 (Bot):**
```bash
npm run dev
```

**Terminal 2 (Dashboard):**
```bash
npm run dashboard:dev
```
Access the dashboard at `http://localhost:3000`.

### Production
For production, you should build the dashboard and run the bot using a process manager like PM2.

1.  **Build Dashboard**:
    ```bash
    npm run dashboard:build
    ```

2.  **Start Dashboard**:
    ```bash
    npm run dashboard:start
    ```
    *Or use PM2: `pm2 start "npm run dashboard:start" --name ixoye-dash`*

3.  **Start Bot**:
    *Build bot first:*
    ```bash
    npm run build
    ```
    *Start:*
    ```bash
    npm start
    ```
    *Or use PM2: `pm2 start dist/bot/index.js --name ixoye-bot`*
