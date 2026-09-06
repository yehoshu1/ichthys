---
title: "Dashboard User Guide"
description: "Tour of the web dashboard and per-guild features."
---

The web dashboard is the command center for your server. It provides a comprehensive interface for configuring all aspects of the ΙΧΘΥΣ bot.

## Search Behavior

- Global search is implemented inside the dashboard app (no external search service).
- Results are composed from settings/doc sources and ranked locally.

## Deep-Dive Module Docs

For implementation-level detail per module, use:

### Core Modules
- [Welcome System](/docs/modules/welcome)
- [Verification System](/docs/modules/verification)
- [Leveling System](/docs/modules/leveling)
- [Boost Management](/docs/modules/boosts)
- [Birthdays](/docs/modules/birthdays)

### Event Management
- [Events](/docs/modules/events) - Event creation, RSVP, recurring schedules
- [Polls](/docs/modules/polls) - Standard, time, and anonymous polls

### Role Management
- [Role Actions](/docs/modules/role-actions)

### Moderation & Analytics
- [Moderation](/docs/modules/moderation)
- [Analytics](/docs/modules/analytics)
- [Action Logs](/docs/modules/logs)

### Integrations
- [Webhooks & API](/docs/modules/webhooks) - Outgoing webhooks and API keys

### System
- [Settings, Import/Export, and Backups](/docs/modules/settings-and-backups)
- [Message Aliases](/docs/modules/aliases)

See [Module Documentation Index](/docs/modules) for complete list.

---

## Accessing the Dashboard

### Method 1: Discord Command (Recommended)

Use the `/dashboard` command in your Discord server to get a direct link:

```
/dashboard
```

This will display:
- A clickable link to your server's dashboard
- The full URL for copying

### Method 2: Direct URL

1. Navigate to your dashboard URL (e.g., `http://localhost:4000`)
2. Click **Login with Discord**
3. Authorize the application to access your guilds
4. Select the server you wish to manage from the list
5. **Note:** You must have **Manage Server** permission to access a guild's dashboard

### Dashboard URL Configuration

The dashboard URL is configured by the bot administrator via the `DASHBOARD_URL` environment variable:

```bash
DASHBOARD_URL=https://dashboard.yourdomain.com
```

Users can access the dashboard using the `/dashboard` command, which will provide them with the configured URL.

---

## Dashboard Overview

The dashboard is organized into several modules accessible from the left sidebar:

### Navigation Menu

| Module | Description |
|--------|-------------|
| **Overview** | Server stats, activity heatmap, top members |
| **Events** | Event creation, RSVP management, templates |
| **Polls** | Standard polls, time polls, anonymous voting |
| **Welcome** | Welcome messages, triggers, templates |
| **Verification** | Auto-kick settings, verification profiles |
| **Leveling** | XP settings, level rewards, leaderboard |
| **Boosts** | Boost rewards configuration |
| **Birthdays** | Birthday announcements and celebration settings |
| **Role Actions** | Automated role-based actions |
| **Reaction Roles** | Reaction-based self-role management |
| **Webhooks & API** | Webhook endpoints, API keys |
| **Moderation** | Auto-mod filters and moderation controls |
| **Analytics** | Activity heatmap, top members |
| **Settings** | Import/export configuration |
| **Documentation** | Quick reference guide |

---

## Module Guide

### 📅 Events

Create and manage server events with RSVP tracking.

#### Calendar View Tab (Default)
Interactive calendar for visualizing and managing events:
- **View Modes**: Month, Week, or Day view
- **Visual Layout**: Color-coded events with time indicators
- **Quick Create**: Click any date to create an event (auto-fills the date)
- **Quick Edit**: Click any event to view details and edit
- **Navigation**: Previous/Next buttons, "Today" shortcut
- **Event Density**: Shows event count when multiple events on same day
- **Responsive**: Fully optimized for mobile, tablet, and desktop

#### Upcoming Events Tab
List view of all scheduled events with:
- Event title and description
- Date, time, and location
- RSVP counts (Yes/Maybe/No/Waitlist)
- Color-coded event cards
- Recurring event indicators

**Event Actions:**
- **Edit**: Modify event details
- **Duplicate**: Create a copy of the event
- **Delete**: Remove the event

#### Creating an Event

1. Click **Create Event**
2. Fill in event details:
   - **Title**: Event name
   - **Description**: Event details
   - **Channel**: Where to post the event
   - **Start Time**: When the event begins
   - **End Time**: When the event ends (optional)
   - **Location**: Physical or virtual location
   - **Color**: Visual theme for the event card
3. Configure RSVP settings:
   - **Max Attendees**: Limit attendance (optional)
   - **Enable Waitlist**: Allow waitlist when full
   - **Required Roles**: Who can attend
   - **Blocked Roles**: Who cannot attend
   - **Attendee Role**: Auto-assign role to attendees
4. Set recurrence (optional):
   - **Frequency**: Daily, weekly, bi-weekly, monthly, yearly
   - **End Date**: When recurrence stops
5. Configure mentions:
   - **Mention on Create**: Ping roles when posted
   - **Mention on Start**: Ping roles when event begins

#### Templates Tab
Save common event configurations:
- Template name and description
- Default title, description, location
- Default duration and color
- Quick apply when creating events

#### Settings Tab
Configure server-wide defaults:
- Default event channel
- Default mention settings
- Server timezone

---

### 📊 Polls

Create polls to gather opinions and schedule events.

#### Active Polls Tab
View all active polls with:
- Poll question and description
- Vote counts
- Poll type (Standard/Time/Anonymous)
- Time remaining (if set)

**Poll Actions:**
- **View Results**: See voting breakdown
- **Edit**: Modify poll settings
- **Close**: End voting early
- **Delete**: Remove the poll

#### Creating a Poll

1. Click **Create Poll**
2. Select poll type:
   - **Standard**: Multiple choice voting
   - **Time Poll**: When2meet-style time scheduling
   - **Anonymous**: Hidden voter identities
3. Configure poll:
   - **Question**: What you're asking
   - **Description**: Additional context
   - **Channel**: Where to post
4. Add options (for standard polls):
   - Option text and optional emoji
   - Minimum 2 options required
5. Set poll settings:
   - **Allow Multiple Votes**: Users can vote for multiple options
   - **Max Votes Per User**: Limit multiple votes
   - **Allow Custom Options**: Users can add options
   - **Anonymous Voting**: Hide who voted
   - **End Time**: Auto-close poll
   - **Role Restrictions**: Limit who can vote

#### Time Poll Creation

For scheduling events:
1. Select **Time Poll** type
2. Set event duration (30m, 1h, 1.5h, 2h, 3h, 4h)
3. Choose date range
4. Set time range (earliest to latest)
5. System generates time slot options automatically

#### Results View
- Bar chart visualization
- Vote counts and percentages
- Winner highlighting
- Total votes cast

---

### 🔗 Webhooks & API

Manage integrations and programmatic access.

#### Webhooks Tab

Configure outgoing webhooks for real-time notifications.

**Webhook List:**
- Name and endpoint URL
- Enabled/disabled status
- Event types subscribed
- Health status (healthy/failing)
- Last success/failure times

**Creating a Webhook:**
1. Click **Add Webhook**
2. Configure:
   - **Name**: Identifier for the webhook
   - **Endpoint URL**: HTTPS URL to receive POST requests
   - **Secret**: Optional secret for HMAC signature verification (encrypted at rest)
   - **Event Types**: Which events to subscribe to
     - Event created/updated/deleted/started
     - RSVP yes/no/maybe/waitlist
     - Poll created/voted/closed
   - **Enabled**: Whether to send notifications
3. **Important**: If you set a secret, save it separately - it's encrypted and cannot be retrieved later!

**Security Note:** Webhook secrets are encrypted with AES-256-GCM before storage and never shown in plain text after creation. The secret is securely decrypted only when signing webhook payloads.

**Webhook Actions:**
- **View Logs**: See delivery history
- **Send Test**: Test the endpoint
- **Edit**: Modify configuration
- **Delete**: Remove the webhook

**Delivery Logs:**
- Timestamp
- Event type
- HTTP status code
- Response time
- Success/failure indicator

#### API Keys Tab

Generate API keys for programmatic access.

**API Key List:**
- Key name
- Status (active/disabled)
- Permissions granted
- Usage count
- Last used time
- Expiration date (if set)

**Creating an API Key:**
1. Click **Create API Key**
2. Configure:
   - **Name**: Identifier for the key
   - **Permissions**: Select access levels
     - events:read, events:write
     - polls:read, polls:write
     - webhooks:read, webhooks:write
   - **Expiration**: Optional expiration (7d, 30d, 90d, 1yr)
3. **Important**: Copy the key immediately - it's only shown once!

**Security Notes:**
- **API keys are never stored in plain text** - they're hashed with SHA-256
- **Keys are only shown once** during creation - copy and save them securely
- **Key hashes are never exposed** - only metadata (name, permissions, status) is returned
- Track usage and rotate keys regularly
- Disable unused keys immediately
- Set expiration dates for temporary access

---

### 👋 Welcome System

Configure automated welcome messages for new members.

#### General Settings Tab
- **Enable Welcome System**: Master toggle for all welcome features
- **Auto-Role**: Automatically assign a role when users join
- **Join Message**: Send a message when someone joins
  - Select target channel
  - Configure message content (plain text or embed)
  - Use variables: `{user}`, `{username}`, `{server}`, `{memberCount}`
- **Leave Message**: Send a message when someone leaves
  - Same configuration options as join message

#### Triggers Tab
Create role-based welcome triggers:
1. Click **Add Trigger**
2. Select the **Role** to watch (e.g., "Member")
3. Choose a **Message Template**
4. Select **Channel** or leave blank for DM
5. Enable/disable the trigger

When a user receives the selected role, the template message is sent.

#### Templates Tab
Create reusable message templates:
1. Click **Create New Template**
2. Enter template name (e.g., "VIP Welcome")
3. Write message content
4. **Optional**: Enable embed for rich formatting
   - Title, description, color
   - Thumbnail/image URLs
   - Footer text, author

**Template Variables:**
- `{user}` - User mention (@username)
- `{username}` - Username without mention
- `{server}` - Server name
- `{memberCount}` - Current member count
- `{date}` - Current date
- `{time}` - Current time
- `{role}` - Name of the triggered role

---

### 🛡️ Verification System

Protect your server with automated verification tracking.

#### Configuration Section
- **Enable Auto-Kick System**: Toggle verification enforcement
- **Unverified Role**: Role assigned to new members (optional)
- **Verification Role**: Role given when verified (required)
- **Grace Period**: Days before unverified users are kicked (1-365)
- **Send DM Before Kicking**: Notify users before removal
- **Default Verification Message**: Sent to channel when user verifies

#### Role-Specific Messages
Send different welcome messages based on user's existing roles:
- Click a role from the list
- Configure custom message
- Enabled/disabled per role

#### Additional Verification Profiles
Create separate verification flows:
1. Set profile name (e.g., "Adult", "Member")
2. Select verified role for this profile
3. Choose notification channel
4. Write custom message
5. Use `/verify @user profile_name` to apply

#### Statistics Panel
- **Verified**: Count of verified users
- **Unverified**: Pending verifications
- **Auto-Kicked**: Historical kick count
- **Verification Progress Bar**: Visual percentage

#### Recently Auto-Kicked
Shows last 10 users kicked for non-verification with date.

#### Unverified Users
Shows users approaching grace period limit (last 10).

---

### ⭐ Leveling System

Gamify your community with XP and levels.

#### Settings Tab

**Enable Leveling System**: Master toggle

**XP Rates:**
- **Min Text XP**: Minimum XP per message (default: 15)
- **Max Text XP**: Maximum XP per message (default: 25)
- **Text XP Cooldown**: Seconds between XP gains (default: 60)
- **Voice XP Per Minute**: XP earned in voice channels (default: 10)

**Notifications:**
- **Send Level Up Messages**: Toggle notifications
- **Level Up Channel**: Fixed channel or blank for context channel
- **Custom Level Up Message**: Personalized congratulations
  - Variables: `{user}`, `{level}`, `{xp}`
  - Default: "🎉 **Level Up!** {user} has reached level **{level}**!"

**Level Rewards:**
Assign roles at specific levels:
1. Enter level number (e.g., 10)
2. Select role to award
3. Click **Add Reward**
4. Users receive role when reaching that level

#### Leaderboard Tab
View top members by:
- **Total XP**: Combined text + voice
- **Text XP**: Message activity only
- **Voice XP**: Voice time only

Shows:
- User avatar and name
- Current level
- XP amount
- Voice time (for voice leaderboard)

**Level Formula:** `Level = 0.1 * sqrt(Total XP)`

Level-up requirements:
- Level 1: 100 XP
- Level 5: 2,500 XP
- Level 10: 10,000 XP
- Level 25: 62,500 XP
- Level 50: 250,000 XP

---

### 🚀 Boost Management

Reward and track server boosters.

#### Configuration
- **Enable Boost System**: Master toggle
- **Boost Announcement Channel**: Where to post thank-you messages
- **Boost Role**: Special role for boosters (auto-assigned)
- **Claim Required**: Users must run `/boost claim` to get role
- **Role Removal Grace Period**: Days after boost ends to remove role
- **Send DM on Removal**: Notify users when reward expires

**Welcome Messages:**
- **New Boost Message**: For first-time boosters
- **Re-Boost Message**: For returning boosters
- Both support variables: `{user}`, `{server}`, `{boostCount}`, `{boostLevel}`

#### Boost Stats
- **Active Boosters**: Currently boosting
- **Total Historical**: All-time booster count
- **Total Boosts**: Cumulative boost count

---

### 🎂 Birthdays

Celebrate member birthdays automatically.

#### Configuration

**Enable Birthday Module**: Master toggle

**Channel Settings:**
- **Announcement Channel**: Where birthday messages are posted
- **Birthday Role**: Optional role assigned to birthday users (auto-removed after)

**Message Settings:**
- **Custom Message**: Birthday announcement template
  - Variables: `{user.mention}`, `{user.username}`, `{age}`, `{server.name}`
  - Default: "🎉 **Happy Birthday {user.mention}!** 🎂 They are now {age} years old!"
- **Hour to Send**: What time (0-23) to post messages
- **Show Age**: Include age calculation if birth year provided
- **Mention Role**: Select a role to mention (@everyone, @here, or a specific role)
- **Auto-Remove Role**: Remove birthday role after day ends

#### Members Tab
View all members who have set their birthdays:
- Username and avatar
- Birthday date (Month Day)
- Timezone
- Remove button (admin only)

**Users set birthdays via:** `/birthday set day:15 month:6 year:1995`

---

### 💬 Message Aliases

Create custom trigger words that make the bot respond with predefined messages (auto-responder).

#### Creating Aliases

Click **"Add Alias"** to create a new auto-responder:

**Basic Settings:**
- **Trigger Word**: The word that triggers the response (e.g., `rules`, `help`, `faq`)
- **Response Message**: The message content the bot sends
- **Embed (Optional)**: Rich Discord embed in JSON format

**Behavior Settings:**
- **Require Prefix**: `!`, `.`, or none (e.g., `!rules` vs just `rules`)
- **Cooldown**: Seconds between uses per user (prevents spam)
- **Case Sensitive**: Require exact capitalization match
- **Delete Trigger**: Remove the triggering message after responding

**Restrictions:**
- **Allowed Channels**: Limit to specific channels (empty = all channels)
- **Required Role**: Require specific roles to use (empty = all users)

#### Managing Aliases

- **List View**: See all aliases with trigger and usage stats
- **Quick Toggle**: Enable/disable aliases from the list
- **Usage Counter**: Track how often each alias is used
- **Edit/Delete**: Modify or remove existing aliases

#### Example Aliases

| Trigger | Prefix | Response |
|---------|--------|----------|
| rules | ! | Check <#rules-channel> for our server rules! |
| help | ! | Need help? Contact a moderator or check our FAQ |
| invite | ! | Join our server: discord.gg/invite-link |

---

### 🤖 Role Actions

Automate actions when members receive or lose roles.

#### Creating Actions

1. Click **Add Action**
2. Configure trigger:
   - **Trigger**: Role Added or Role Removed
   - **Role**: Which role to watch
3. Select action type:
   - **Send Direct Message**: DM the user
   - **Send Channel Message**: Post to specific channel
   - **Kick Member**: Remove from server
   - **Post to Log**: Record in log channel
4. Set delay (minutes): 0 for immediate, or schedule later
5. Configure message content (if applicable)
6. Enable/disable the action

**Use Cases:**
- Welcome DM when "Member" role added
- Kick if "Muted" role added (with delay for warning)
- Log to mod channel when "Admin" role removed
- Send rules when "New" role added

**Message Variables:**
- `{user}` - User mention
- `{username}` - Plain username
- `{server}` - Server name
- `{memberCount}` - Member count

---

### 🎭 Reaction Roles

Create self-assignable roles via reactions, buttons, or dropdowns.

#### Creating Reaction Roles

1. Click **Create Reaction Role**
2. Select component type:
   - **Reactions**: Traditional emoji reactions
   - **Buttons**: Discord button components
   - **Dropdown**: Discord select menu
3. Configure message:
   - **Channel**: Where to post
   - **Title**: Message title
   - **Description**: Message content
4. Add role mappings:
   - Select role
   - Choose emoji (for reactions/buttons)
   - Set description (for buttons/dropdown)
   - Choose behavior type:
     - **Toggle**: Add/remove on click
     - **Add Only**: Can only add role
     - **Remove Only**: Can only remove role
     - **Unique**: Only one role from group
5. Post the message

---

### 📊 Analytics

View server activity insights.

#### Stats Cards
- **Total Members**: Live member count
- **Verified**: Verified user count
- **Voice Hours**: Total voice time (all users)
- **Retention Rate**: % of members who stayed 7+ days
- **Boosts**: Active boost count
- **Actions (24h)**: Automated actions executed today

#### Activity Heatmap
Visual grid showing message activity by day and hour:
- **X-axis**: Hours (0-23)
- **Y-axis**: Days (Sun-Sat)
- **Color intensity**: Message volume
- Hover for exact count

#### Top Active Members
Leaderboard of top 5 XP earners with:
- Avatar
- Username
- Level
- Total XP

---

### ⚙️ Settings

#### Import/Export
- **Export Configuration**: Download all settings as JSON
- **Import Configuration**: Upload JSON to restore settings
- Useful for:
  - Backing up before major changes
  - Cloning settings to new servers
  - Sharing configurations

---

## UI Features

### Theme Support
Toggle between light and dark modes using the sun/moon icon in the header.

### Mobile Responsive
Dashboard adapts to mobile screens with:
- Collapsible sidebar menu
- Stacked layouts
- Touch-friendly controls

### Real-Time Data
Most data updates automatically:
- Discord roles/channels fetched live
- Stats refresh on page load
- Manual refresh button available

### Permission-Based Access
- Only users with **Manage Server** can access dashboard
- Bot membership checked on load
- Invite link shown if bot not in server

---

## Troubleshooting

### Dashboard Won't Load
- Verify you're logged in with Discord
- Check that you have Manage Server permission
- Ensure bot is in the server

### Changes Not Saving
- Check browser console for errors
- Verify bot has required Discord permissions
- Ensure database is writable

### Data Looks Wrong
- Use `/config sync` in Discord to refresh member data
- Check feature toggles are enabled
- Verify role/channel selections are valid

### Discord Data Not Loading
- Bot token may be invalid
- Discord API may be rate limited
- Try refreshing the page

---

## Tips & Best Practices

1. **Test Welcome Messages**: Use `/welcome test` before going live
2. **Start with Defaults**: Use default XP rates, adjust based on activity
3. **Set Reasonable Grace Periods**: 7-30 days for verification
4. **Use Role Actions Carefully**: Test kick actions thoroughly
5. **Regular Backups**: Export config monthly
6. **Monitor Analytics**: Check weekly for trends
7. **Poll Engagement**: Use time polls for scheduling with multiple people
8. **Webhook Security**: Always use secrets and verify HMAC signatures in production
9. **API Key Rotation**: Rotate keys every 90 days and use expiration dates
10. **Environment Secrets**: Ensure `WEBHOOK_SECRET_ENCRYPTION_KEY` and `ANONYMIZE_SECRET` are set for webhook and anonymous poll features
