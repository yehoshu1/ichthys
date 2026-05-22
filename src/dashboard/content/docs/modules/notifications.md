---
title: "Notifications"
description: "Operational notifications and read state."
---

Notification stream and delivery preferences for operational events.

## Dashboard Route

- Notification bell in `/dashboard/[guildId]` header

## API Endpoints

- `GET /api/guilds/[guildId]/notifications`
- `PATCH /api/guilds/[guildId]/notifications/read`
- `GET /api/guilds/[guildId]/notifications/unread-count`
- `GET/PUT /api/guilds/[guildId]/notifications/preferences`

## Database Tables

- `notification_event`
- `notification_delivery`
- `notification_preference`
- `notification_user_state`
- `notification_user_cursor`

## Runtime Components

- `src/bot/jobs/processNotificationDeliveries.ts`
- `src/dashboard/components/GuildNotificationBell.tsx`

## Typical Workflow

1. Open the notification bell in the dashboard.
2. Review unread events and mark them read.
3. Configure event-type preferences and channels.
4. Monitor delivery status for failures/retries.

## Failure Modes

- No events appear when producers do not emit `notification_event`.
- Delivery failures accumulate when webhook/channel targets are invalid.
