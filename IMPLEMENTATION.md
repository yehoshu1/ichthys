# ΙΧΘΥΣ Bot - Implementation Guide

## Quick Start

This document outlines the 7-phase implementation plan for the ΙΧΘΥΣ Discord bot.

## Technology Stack

- **Bot**: Discord.js v14, TypeScript, Node.js
- **Dashboard**: Next.js 14, TailwindCSS, shadcn/ui
- **Database**: SQLite + Prisma ORM
- **Auth**: Discord OAuth2 (NextAuth.js)
- **Jobs**: node-cron for scheduled tasks

## Project Structure

```
ixoye/
├── src/
│   ├── bot/              # Discord bot code
│   │   ├── commands/     # Slash commands
│   │   ├── events/       # Event handlers
│   │   ├── services/     # Business logic
│   │   └── jobs/         # Cron jobs
│   ├── dashboard/        # Next.js dashboard
│   │   ├── app/          # App router pages
│   │   └── components/   # React components
│   └── shared/           # Shared code
│       └── database/     # Prisma schema & client
├── prisma/
│   └── schema.prisma
└── docs/
```

## Database Schema (8 Tables)

1. **GuildConfig** - Server settings
2. **WelcomeTrigger** - Role → message mapping
3. **MessageTemplate** - Message templates
4. **UserJoin** - Join/verification tracking
5. **UserBoost** - Boost tracking & role
6. **LevelProfile** - User XP/levels
7. **RoleAction** - Role-based automations
8. **ActionLog** - Action audit trail

## Implementation Phases

### **PHASE 1: Foundation** (Week 1)
- Discord.js setup with intents
- Prisma + SQLite database
- Guild config service
- Discord OAuth dashboard
- Basic dashboard UI

### **PHASE 2: Welcome System** (Week 2)
- Role-based message triggers
- Template storage & management
- Placeholder replacement system
- Message sending (channel/DM)
- Dashboard template editor

### **PHASE 3: Verification Tracking** (Week 3)
- Track user join times
- Track verification status
- Daily cleanup cron job
- Auto-kick unverified users
- Verification dashboard

### **PHASE 4: Boost Management** (Week 4)
- Detect boost events
- Boost welcome messages
- Assign per-user boost role
- 30-day role tracking
- Auto-remove expired roles
- Boost dashboard config

### **PHASE 5: Leveling System** (Week 5)
- Text XP from messages
- Voice XP tracking
- XP database storage
- Level-up notifications
- Leaderboard & dashboard

### **PHASE 6: Role Actions** (Week 6)
- Monitor role additions
- Configurable actions (DM, KICK, LOG)
- Action delay system
- Action logging
- Role actions dashboard

### **PHASE 7: Polish** (Week 7)
- Analytics dashboard
- Config export/import
- Mobile optimization
- Error handling & logging
- Documentation

## Discord Commands

- `/rank` - Check your level
- `/leaderboard` - Server rankings
- `/welcome test` - Test welcome message
- `/boost status` - Check boost status
- `/config` - Quick configuration

## Dashboard Pages

1. **Overview** - Stats & metrics
2. **Welcome Messages** - Role triggers
3. **Verification** - Auto-kick settings
4. **Boost Management** - Boost rewards
5. **Leveling** - XP configuration
6. **Role Actions** - Automations
7. **Analytics** - Charts & graphs
8. **Settings** - Export/import

## Environment Variables

```env
# Discord Bot
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret

# Database
DATABASE_URL=file:./data/ixoye.db

# Dashboard
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_random_secret
NODE_ENV=development
```

## Getting Started

1. **Clone and install**
   ```bash
   npm install
   ```

2. **Set up database**
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Fill in your Discord credentials
   ```

4. **Run development**
   ```bash
   npm run dev        # Start bot
   npm run dashboard  # Start dashboard (parallel)
   ```

## Development Workflow

1. Follow phases in order
2. Test each feature before moving on
3. Update task.md checkboxes as you progress
4. Commit after each completed sub-feature
5. Deploy to test server frequently

## Key Features by Priority

**Must Have (MVP)**
1. ✅ Welcome system
2. ✅ Verification tracking
3. ✅ Boost management
4. ✅ Basic dashboard

**Should Have**
5. ✅ Leveling system
6. ✅ Role actions
7. ✅ Analytics

**Nice to Have**
8. Config templates
9. Advanced analytics
10. Mobile app (future)

## Testing Strategy

- Unit tests for services
- Integration tests for APIs
- Manual testing in test server
- E2E tests for critical flows

## Deployment

- **Bot**: Railway, DigitalOcean, or VPS with PM2
- **Dashboard**: Vercel, Netlify, or Railway
- **Database**: PostgreSQL for production
- **Monitoring**: Sentry for errors, PM2 for uptime

## Contributing

See detailed task breakdown in `/brain/task.md`

## License

MIT License

---

**For detailed implementation plan, see**: `~/.gemini/antigravity/brain/*/implementation_plan.md`  
**For task tracking, see**: `~/.gemini/antigravity/brain/*/task.md`
