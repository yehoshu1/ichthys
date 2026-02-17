# Webhook Fix - Complete Implementation

## Problem
Webhooks were configurable in the dashboard but never actually fired because:
1. `webhookEndpoint` and `webhookDelivery` tables didn't exist in the shared schema
2. The bot couldn't access the tables to trigger webhooks
3. Webhook triggering code was commented out

## Solution

### 1. Added Webhook Tables to Shared Schema
**File:** `src/shared/database/schema.ts`

Added 4 new tables:
- `webhookEndpoint` - Stores webhook configurations
- `webhookDelivery` - Stores webhook delivery logs
- `apiKey` - Stores API keys for external access

### 2. Created Webhook Service
**File:** `src/bot/services/webhook-service.ts`

Features:
- `triggerEvent()` - Triggers webhooks for specific events
- `deliverWebhook()` - Delivers payload to endpoint with signature
- `recordFailure()` - Tracks failures, disables after 10 failures
- `testWebhook()` - Sends test payload
- Automatic retry with exponential backoff
- HMAC-SHA256 signature generation

### 3. Enabled Webhook Triggers
**Files:** 
- `src/bot/services/event-service.ts`
- `src/bot/services/poll-service.ts`

Webhook events now fired:
- `event.created` - When event is created
- `rsvp.yes/no/maybe/waitlist` - When user RSVPs
- `poll.voted` - When user votes in poll
- `poll.closed` - When poll is closed

## Webhook Payload Format

```json
{
  "event": "event.created",
  "timestamp": "2026-02-11T12:00:00.000Z",
  "guildId": "123456789",
  "data": {
    "eventId": "uuid",
    "title": "Raid Night",
    "creatorId": "user-id",
    "startTime": "2026-02-12T20:00:00.000Z",
    "channelId": "channel-id"
  }
}
```

## Security Features

1. **HTTPS Only** - HTTP URLs rejected
2. **SSRF Protection** - Private IPs blocked (localhost, 10.x, 172.16-31.x, 192.168.x)
3. **HMAC Signatures** - Optional secret for payload verification
4. **Signature Header** - `X-Webhook-Signature: sha256=<hash>`

## Health Monitoring

- Tracks `failureCount` per webhook
- Auto-disables after 10 consecutive failures
- Records `lastSuccessAt` and `lastFailureAt`
- Delivery logs stored in `webhookDelivery` table

## Database Migration Required

Run after deployment:
```bash
bun run db:generate
bun run db:push
```

This will create the new tables in the database.

## Testing

1. Configure webhook in dashboard with URL and event types
2. Trigger an event (create event, RSVP, vote in poll)
3. Check delivery logs in dashboard
4. Verify payload received at endpoint

## Build Status
```bash
$ bun run build
✅ Build successful
```
