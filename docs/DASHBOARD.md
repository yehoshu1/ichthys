# ΙΧΘΥΣ Dashboard User Guide

The ΙΧΘΥΣ Dashboard is a web interface for managing your Discord server's bot configuration. This guide explains how to access and use the dashboard.

## Accessing the Dashboard

1. Use the `/dashboard` command in Discord to get a link to your server's dashboard
2. Click the link to open the dashboard in your browser
3. Sign in with your Discord account (OAuth2 authentication)

## Authentication

- The dashboard uses Discord OAuth2 for authentication
- You must be a member of the server to access its dashboard
- Administrative features require appropriate Discord permissions

## Dashboard Sections

### Overview
- View server statistics and analytics
- See recent activity and growth metrics
- Quick access to common settings

### Welcome System
- Configure welcome messages for new members
- Set up role-based triggers with custom templates
- Customize welcome images with colors, gradients, or backgrounds
- Configure verification requirements

### Leveling
- View server XP leaderboard
- Configure level-up rewards and role assignments
- Set XP rates for text and voice channels
- View individual user level profiles

### Events
- Create and manage server events
- Configure recurring event schedules
- Set up event reminders and notifications
- Manage RSVP settings

### Polls
- Create standard, time-based, or anonymous polls
- View poll results and participation
- Configure poll permissions

### Birthdays
- View upcoming birthdays
- Configure birthday announcement settings
- Set up birthday roles and messages

### Moderation
- View moderation cases and history
- Configure auto-moderation settings
- Manage the staff watchlist
- Review action logs

### Webhooks
- Create and manage webhook endpoints
- View delivery logs and status
- Configure webhook secrets for security

### API Keys
- Generate API keys for programmatic access
- Manage key permissions and scopes
- View usage statistics

### Notifications
- Configure notification preferences
- View notification history
- Set up delivery channels

## User Preferences

### Timezone
- Set your timezone for accurate event times
- Used for birthday announcements and event reminders

### Notification Settings
- Choose which notifications you receive
- Configure notification delivery preferences

## Common Tasks

### Changing Server Settings
1. Navigate to the relevant section in the dashboard
2. Make your changes
3. Click "Save" to apply changes immediately

### Viewing Analytics
1. Go to the Overview section
2. Use date filters to view specific time periods
3. Export data if needed

### Managing Webhooks
1. Navigate to the Webhooks section
2. Click "Add Webhook" to create a new endpoint
3. Configure the URL and event subscriptions
4. Save and test the webhook

## Troubleshooting

### Can't Access Dashboard
- Ensure you're signed in with the correct Discord account
- Verify you have access to the server
- Check that the bot is still in the server

### Changes Not Saving
- Verify you have the required permissions
- Check for form validation errors
- Refresh the page and try again

### OAuth Errors
- Ensure `NEXTAUTH_SECRET` is configured correctly
- Verify the Discord app redirect URI matches `NEXTAUTH_URL`
- Check that your Discord app credentials are correct

## Technical Details

- Built with Next.js 16 (App Router)
- Uses React 19 and Tailwind CSS 4
- Authentication via NextAuth.js v4
- Database: PostgreSQL with Drizzle ORM
