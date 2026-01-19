# ΙΧΘΥΣ (Ixoye) Discord Bot & Dashboard

A powerful, scalable, and feature-rich Discord bot with a comprehensive web dashboard for community management. Built with modern web technologies to ensure performance, reliability, and ease of use.

## 🚀 Features

### Core Modules
- **📊 Analytics Dashboard**: Visualize server growth, member retention, module usage, and more with interactive charts.
- **👋 Welcome System**: Customizable welcome messages (text & embed) with role-based triggers and placeholder support.
- **🛡️ Verification**: Automated verification tracking, grace periods, and auto-kick for unverified members to keep your server safe.
- **🚀 Boost Management**: Track server boosts, reward boosters with roles, and send custom thank-you messages.
- **⭐ Leveling System**: XP tracking for text and voice, customizable level-up messages, leaderboards, and role rewards.
- **🤖 Role Actions**: Automate actions (DM, Kick, Log) when members gain or lose specific roles.

### Tech Stack
- **Bot**: [Discord.js](https://discord.js.org/) v14, TypeScript
- **Dashboard**: [Next.js](https://nextjs.org/) 15 (App Router), [React](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/)
- **Database**: [SQLite](https://www.sqlite.org/) with [Drizzle ORM](https://orm.drizzle.team/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/), [Lucide Icons](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/)

## 📂 Documentation

- **[Setup Guide](docs/SETUP.md)**: How to install, configure, and run the bot locally or in production.
- **[Dashboard Guide](docs/DASHBOARD.md)**: A walkthrough of the web dashboard features and configuration.
- **[Commands Reference](docs/COMMANDS.md)**: a list of available slash commands and their permissions.

## 🛠️ Quick Start

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/ixoye-bot.git
    cd ixoye-bot
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Setup Environment**
    Copy `.env.example` to `.env` and fill in your Discord and NextAuth credentials.
    ```bash
    cp .env.example .env
    ```

4.  **Initialize Database**
    ```bash
    npm run db:push
    ```

5.  **Run Development**
    ```bash
    # Run bot
    npm run dev

    # Run dashboard (in a separate terminal)
    npm run dashboard:dev
    ```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.
