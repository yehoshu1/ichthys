# ΙΧΘΥΣ Bot - Update Notes

## 🎉 Version 2.0.0 - Major Update (February 2026)

We're excited to announce a major update to ΙΧΘΥΣ! This release brings significant improvements, new features, and a complete infrastructure upgrade.

---

## ✨ What's New

### 🎪 **Events System**
Create and manage server events with comprehensive features:
- **RSVP Tracking** - Members can respond with Yes/No/Maybe, with optional waitlist support
- **Smart Scheduling** - Set event times, durations, and recurring schedules
- **Reminders** - Automatic DM reminders before events start (customizable per user)
- **Role Restrictions** - Require specific roles or block certain roles from RSVPing
- **Attendee Roles** - Automatically assign roles to confirmed attendees
- **Discord Integration** - Mirror events to Discord's native scheduled events
- **Event Templates** - Save and reuse event configurations

**Commands:** `/event create`, `/event list`, `/event info`, `/event edit`, `/event cancel`, `/rsvp`, `/reminder`

### 📊 **Advanced Polling System**
Three types of polls to fit any need:
- **Standard Polls** - Traditional multiple-choice voting with single or multi-select
- **Time Polls** - When2meet-style availability scheduling (perfect for finding meeting times)
- **Anonymous Polls** - Secure voting where responses are hashed (results shown after closing)
- **Poll Templates** - Save frequently used poll formats
- **Customization** - Set vote limits, allow custom options, restrict by role
- **Auto-close** - Polls automatically close at scheduled time

**Commands:** `/poll create`, `/poll create time`, `/poll close`, `/poll results`

### 🎭 **Enhanced Reaction Roles**
Multiple ways for members to self-assign roles:
- **Reactions** - Classic reaction-based role assignment
- **Buttons** - Modern button-style role selection
- **Dropdown Menus** - Clean dropdown selection for many roles
- **Multiple Messages** - Create unlimited reaction role messages per server

**Commands:** `/reactionrole create`, `/reactionrole add`, `/reactionrole remove`, `/reactionrole list`, `/reactionrole delete`

### 🔗 **Webhooks & API Integration**
Integrate ΙΧΘΥΣ with your external tools:
- **Real-time Notifications** - Receive HTTP POST requests for events, polls, RSVPs, and more
- **HMAC Signatures** - Secure webhook verification with secret keys
- **Automatic Retries** - Failed deliveries are retried with exponential backoff
- **SSRF Protection** - Built-in security against malicious webhook URLs
- **Event Types**: `event.created`, `event.updated`, `event.started`, `rsvp.yes`, `poll.created`, `poll.voted`, and more

### 🔑 **API Keys**
Programmatic access to your server data:
- **Granular Permissions** - Control read/write/delete access per key
- **Secure Storage** - Keys are hashed with SHA-256
- **Rate Limiting** - Automatic throttling to prevent abuse
- **Audit Logs** - Track all API key usage

### 🎂 **Birthday System**
Never miss a member's special day:
- **Timezone Support** - Accurate birthday announcements worldwide
- **Age Calculation** - Optional age display in announcements
- **Custom Messages** - Personalize birthday greetings
- **Birthday Roles** - Temporary roles on members' birthdays
- **Privacy** - Members control whether to show their age

**Commands:** `/birthday set`, `/birthday remove`, `/birthday view`, `/birthday list`, `/birthday next`, `/birthday stats`

### 🔔 **In-App Notifications**
Stay informed about bot activities:
- **Notification Stream** - See bot actions in real-time from the dashboard
- **User Preferences** - Control which notifications you receive
- **Read Tracking** - Mark notifications as read/unread
- **Multi-channel Support** - DM, channel mentions, and in-app display

### 📈 **Enhanced Analytics**
Deeper insights into your community:
- **Message Activity Heatmaps** - Visualize when your server is most active
- **Server Growth Tracking** - Monitor member joins/leaves over time
- **Member Retention** - Track how long members stay in your server
- **Module Usage Stats** - See which features are most popular
- **Verification Analytics** - Monitor verification rates and kicked users

---

## 🔧 Improvements

### Welcome System
- ✨ **Image Generation** - Create custom welcome images with user info
- ✨ **Profile-based Messages** - Send different messages based on member profiles
- ✨ **Role-specific Triggers** - Enhanced role-based welcome logic
- 🔧 **Better Template System** - More placeholders and formatting options

### Verification System
- ✨ **Profile Verification Messages** - Send custom messages based on verification profiles
- ✨ **Message Rules** - Configure verification messages with channel notifications
- 🔧 **Improved Tracking** - Better join/verification status monitoring
- 🐛 **Fixed Duplicate Messages** - Verification messages now send only once
- 📊 **Verification Stats** - Dashboard shows verification rates and trends

### Leveling System
- ✨ **Dual XP Tracking** - Separate text and voice XP with combined totals
- ✨ **Enhanced Leaderboards** - Sortable by text XP, voice XP, or total XP
- ✨ **Role Rewards** - Automatically assign roles at specific levels
- 🔧 **Improved XP Calculation** - Level formula: `level = floor(0.1 × √total_xp)`
- 🔧 **Customizable Rates** - Adjust XP rates per server
  - Text: 15-25 XP per message (configurable)
  - Voice: 10 XP per minute (configurable)
  - Cooldown: 60 seconds between text XP gains

### Boost Management
- ✨ **Custom Boost Roles** - Create personalized roles for boosters
- ✨ **Auto-removal** - Remove boost roles after inactivity (default 30 days)
- ✨ **Welcome Messages** - Thank boosters when they first boost
- ✨ **Re-boost Messages** - Acknowledge returning boosters
- 📊 **Boost History** - Track all boost events

### Role Actions
- ✨ **More Action Types** - DM, message to channel, kick, and logging
- ✨ **Delayed Actions** - Schedule actions to execute after a delay
- 🔧 **Improved Reliability** - Better error handling and retry logic

### Moderation
- ✨ **Timed Actions** - Automatic expiration for mutes and timeouts
- ✨ **Enhanced Case System** - Comprehensive moderation case tracking
- ✨ **Message Cleanup** - Bulk delete messages with filters
- 🔧 **Improved Commands** - Better UX for `/warn`, `/mute`, `/kick`, `/ban`

### Dashboard
- ✨ **Modern UI** - Complete redesign with Tailwind CSS 4
- ✨ **Better Navigation** - Sidebar navigation with search
- ✨ **Real-time Updates** - Live data updates without page refresh
- ✨ **Mobile Responsive** - Full mobile support
- 🔧 **Improved Performance** - Faster page loads and data fetching
- 🔧 **Better Forms** - Enhanced validation and error messages
- 🐛 **Fixed Config Saves** - All module settings now save correctly

### Setup Command
- 🐛 **Fixed Button Interactions** - `/setup` command buttons now work properly
- ✨ **Enhanced UX** - Better feedback and confirmation messages
- 🔧 **Improved Layout** - Cleaner interface with better organization

---

## 🏗️ Technical Improvements

### Infrastructure Upgrade
- **PostgreSQL 17** - Migrated from SQLite to enterprise-grade database
  - Better performance for large servers
  - Native JSONB support for complex data
  - Full-text search capabilities
  - Advanced indexing and query optimization
- **Next.js 16** - Updated to latest framework with App Router
- **React 19** - Latest React version with concurrent features
- **Tailwind CSS 4** - Modern styling with better performance
- **Node.js 22** - Latest LTS version

### Security Enhancements
- 🔒 **HTTPS-Only Webhooks** - No more insecure HTTP endpoints
- 🔒 **CSRF Protection** - Enhanced cross-site request forgery protection
- 🔒 **CSP Headers** - Content Security Policy for dashboard
- 🔒 **Encrypted Secrets** - Webhook secrets encrypted at rest
- 🔒 **Rate Limiting** - Redis-backed distributed rate limiting
- 🔒 **API Key Hashing** - SHA-256 hashed key storage

### Performance Optimizations
- ⚡ **Faster Queries** - Optimized database indexes and queries
- ⚡ **Caching** - Redis caching for frequently accessed data
- ⚡ **Lazy Loading** - Dashboard components load on demand
- ⚡ **Job Scheduling** - Efficient cron job management with node-cron
- ⚡ **Deduplication** - Event deduplication to prevent spam

### Developer Experience
- 🛠️ **TypeScript** - Full type safety across bot and dashboard
- 🛠️ **Drizzle ORM** - Modern, type-safe database queries
- 🛠️ **PM2 Integration** - Production process management
- 🛠️ **Docker Support** - Complete Docker Compose setup
- 🛠️ **Automated Backups** - Daily database backups in Docker
- 🛠️ **Hot Reload** - Instant updates during development

---

## 🐛 Bug Fixes

### Critical Fixes
- ✅ Fixed `/setup` command button interactions failing
- ✅ Fixed dashboard config saves returning validation errors
- ✅ Fixed verification profile messages sending twice
- ✅ Fixed JSON serialization errors in verification embeds
- ✅ Fixed PostgreSQL boolean comparisons in verification stats
- ✅ Fixed level data calculation after database migration
- ✅ Fixed CSRF validation behind Cloudflare proxy

### Minor Fixes
- ✅ Fixed role select menus not working in components
- ✅ Fixed channel select menus not dispatching correctly
- ✅ Fixed action log metadata search with JSONB
- ✅ Fixed webhook automatic retries
- ✅ Fixed event message sync errors
- ✅ Fixed poll message sync errors
- ✅ Fixed duplicate notification deliveries

---

## 📊 Statistics

### What's Been Migrated
- ✅ **117 level profiles** - All user XP and levels preserved
- ✅ **312 user joins** - Complete verification history
- ✅ **661 message activity records** - Analytics data maintained
- ✅ **All guild configurations** - Settings transferred perfectly
- ✅ **Recalculated levels** - Accurate level formula applied

### New Capabilities
- **40+ slash commands** - Deployed globally
- **16+ scheduled jobs** - Automated background tasks
- **20+ database tables** - Up from 8 in previous version
- **50+ API endpoints** - Comprehensive dashboard API

---

## 🚀 Getting Started with New Features

### Try Events
1. Use `/event create` to create your first event
2. Set a title, description, and time
3. Members can RSVP with buttons in the event message
4. Set reminders with `/reminder [event] [minutes]`

### Create a Poll
1. Use `/poll create` for standard polls or `/poll create time` for availability polls
2. Add your question and options
3. Members vote by clicking options
4. Close with `/poll close [id]` and view results

### Setup Reaction Roles
1. Use `/reactionrole create` to start
2. Choose between reactions, buttons, or dropdown style
3. Add roles with `/reactionrole add`
4. Members can now self-assign roles!

### Configure Webhooks
1. Visit the Dashboard → Webhooks
2. Add your webhook URL (must be HTTPS)
3. Choose which events to receive
4. Save and test with the "Send Test" button

---

## 🔄 Migration Notes

### For Existing Users
- ✅ **Your data is safe** - All configurations, XP, and history preserved
- ✅ **No setup required** - Bot automatically uses existing settings
- ✅ **Commands work the same** - Familiar commands still available
- ✅ **New features opt-in** - New modules disabled by default

### What Changed
- **Dashboard URL** - Port changed from 3000 to 4002 (update your bookmarks)
- **Command deployment** - Commands now deployed globally (no more guild-specific)
- **Database** - Backend now uses PostgreSQL (no action needed)

---

## 📚 Documentation

Full documentation available:
- **[Setup Guide](docs/SETUP.md)** - Installation and configuration
- **[Dashboard Guide](docs/DASHBOARD.md)** - Dashboard walkthrough
- **[Commands Reference](docs/COMMANDS.md)** - Complete command list
- **[Module Documentation](docs/MODULES.md)** - Feature deep-dives

---

## 🙏 Thank You

Thank you for using ΙΧΘΥΣ! This update represents months of development and testing. We hope you enjoy the new features and improvements.

### Support & Feedback
- **Found a bug?** Please report it on our GitHub Issues
- **Have a suggestion?** We'd love to hear your ideas!
- **Need help?** Check our documentation or reach out

---

## 🔮 Coming Soon

We're already working on future updates:
- 🎵 **Music System** - Play music in voice channels
- 🎮 **Mini Games** - Fun games for your community
- 🏆 **Achievements** - Reward system for member milestones
- 📸 **Image Commands** - Memes, filters, and image manipulation
- 🌍 **Multi-language** - Support for multiple languages

Stay tuned for more updates!

---

**Version:** 2.0.0  
**Release Date:** February 17, 2026  
**Deployment:** Production Ready ✅  
**Serving:** 2+ Guilds

*Made with ❤️ for Discord communities*
