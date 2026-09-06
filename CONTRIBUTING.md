# Contributing to Ichthys

First off, thank you for considering contributing to Ichthys! It's people like you that make open source such a great community.

## Development Environment Setup

The project consists of a Discord bot written in standard TypeScript and a Dashboard built with Next.js 16 (App Router) and TailwindCSS. Both share the `src/shared` directory containing database models.

### Prerequisites
- Node.js v22 or higher
- npm v11+
- PostgreSQL v17

### Getting Started
1. **Clone the repo**
   ```bash
   git clone https://github.com/yehoshu1/ichthys.git
   cd ichthys
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Copy `.env.example` to `.env` and fill out your Discord Client ID, Secret, Bot Token, and Database credentials.
   ```bash
   cp .env.example .env
   ```

4. **Database Setup**
   Ensure PostgreSQL is running and matches your `.env` connection string.
   Push the Drizzle schema to your database:
   ```bash
   npm run db:push
   ```

5. **Start the Development Servers**
   To run both the Bot and Dashboard concurrently with hot-reloading:
   ```bash
   npm run dev:all
   ```

## Making Changes
- **Bot Commands:** When adding new slash commands, place them in `src/bot/commands/` and ensure you export the standard `Command` interface.
- **Database Schema:** We use Drizzle ORM. Modify schemas in `src/shared/database/schema.ts`. Before pushing your PR, generate migrations with `npm run db:generate`.
- **UI Components:** We rely on `shadcn/ui` components located in `src/dashboard/components/ui/`. If you need a new base component, use the shadcn CLI.

## Branch Structure
- `main` - Production-ready code
- `feature/*` - New features
- `fix/*` - Bug fixes
- `chore/*` - Maintenance tasks
- `refactor/*` - Code refactoring

## Submitting a Pull Request
1. Fork the repository and create your branch from `main`.
2. Ensure your code passes typechecking and formatting: `npm run validate`.
3. Open a Pull Request detailing what you changed and why.

Thank you for contributing!
