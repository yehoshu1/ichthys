---
title: "Webhooks & API Module"
description: "Outgoing webhook delivery for events."
---

The Webhooks & API module provides outgoing webhooks for real-time event notifications and API keys for programmatic access.

## Features

- **Outgoing Webhooks**: POST events to external URLs
- **Event Subscriptions**: Choose which events to receive
- **HMAC Signatures**: Verify webhook authenticity
- **Delivery Logs**: Track all webhook attempts
- **Health Monitoring**: Auto-disable failing webhooks
- **API Keys**: Programmatic access with permissions

## Webhooks

### Supported Events

| Event | Description |
|-------|-------------|
| `event.created` | New event created |
| `event.updated` | Event details changed |
| `event.deleted` | Event removed |
| `event.started` | Event start time reached |
| `rsvp.yes` | User RSVP'd yes |
| `rsvp.no` | User RSVP'd no |
| `rsvp.maybe` | User RSVP'd maybe |
| `rsvp.waitlist` | User joined waitlist |
| `poll.created` | New poll created |
| `poll.voted` | User voted in poll |
| `poll.closed` | Poll ended |

### Webhook Payload Format

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

### Security Features

#### Secret Encryption at Rest
- Webhook secrets are encrypted with AES-256-GCM before storage
- Requires `WEBHOOK_SECRET_ENCRYPTION_KEY` environment variable (minimum 16 characters)
- Secrets are only shown once during creation
- Encrypted secrets are automatically decrypted when signing webhook payloads
- Legacy SHA-256 hashed secrets (from previous versions) are detected and cannot be used for HMAC signing

#### HTTPS Only
- HTTP URLs are rejected
- Must use valid HTTPS endpoints

#### SSRF Protection
Private IP ranges are blocked both by hostname and DNS resolution:
- `localhost`, `127.0.0.1`, `::1`
- `10.0.0.0/8`
- `172.16.0.0/12`
- `192.168.0.0/16`
- `169.254.0.0/16` (link-local)
- IPv6 private ranges (ULA, link-local, multicast)

DNS resolution is performed to prevent DNS rebinding attacks.

#### HMAC Signatures
If a secret is configured, webhooks include a signature:

```
X-Webhook-Signature: sha256=<hmac_hex>
```

Verification:
```typescript
const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(payload))
    .digest('hex');

if (`sha256=${signature}` !== req.headers['x-webhook-signature']) {
    throw new Error('Invalid signature');
}
```

### Health Monitoring

- Tracks `failureCount` per webhook
- Auto-disables after 10 consecutive failures
- Resets counter on successful delivery
- Records `lastSuccessAt` and `lastFailureAt`

### Headers

All webhooks include:
```
Content-Type: application/json
User-Agent: IxoyeBot/1.0 WebhookDelivery
X-Webhook-Event: <event_type>
X-Webhook-ID: <webhook_id>
X-Webhook-Delivery: <delivery_id>
X-Webhook-Signature: sha256=<hash> (if secret configured)
```

## API Keys

### Permissions

| Permission | Access |
|------------|--------|
| `events:read` | View events and RSVPs |
| `events:write` | Create and manage events |
| `polls:read` | View polls and votes |
| `polls:write` | Create and manage polls |
| `webhooks:read` | View webhook configurations |
| `webhooks:write` | Manage webhooks |

### Security

- Keys stored as SHA-256 hashes
- Only shown once on creation
- Track usage count and last used time
- Optional expiration dates
- Can be disabled/revoked

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `webhook_endpoint` | Webhook configurations |
| `webhook_delivery` | Delivery attempt logs |
| `api_key` | API key storage |

## API Endpoints

### Webhooks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/guilds/[guildId]/webhooks` | GET/POST | List/create webhooks |
| `/api/guilds/[guildId]/webhooks/[webhookId]` | PATCH/DELETE | Update/delete webhook |
| `/api/guilds/[guildId]/webhooks/[webhookId]/test` | POST | Send test webhook |
| `/api/guilds/[guildId]/webhooks/[webhookId]/logs` | GET | View delivery logs |

### API Keys

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/guilds/[guildId]/api-keys` | GET/POST | List/create API keys |
| `/api/guilds/[guildId]/api-keys/[keyId]` | PATCH/DELETE | Update/delete key |

## Input Validation

### Webhooks
- Name: max 100 characters
- URL: max 500 characters, HTTPS only
- Event types: at least 1 required

### API Keys
- Name: max 100 characters
- Permissions: at least 1 required
- Expiration: optional, must be in future

## Retry Logic

Webhooks use immediate delivery with logging:
- 30-second timeout
- Success: 2xx status code
- Failure: Logged with error details
- No automatic retry (design decision for simplicity)

## Security Considerations

- Webhook secrets stored as SHA-256 hashes
- API keys stored as SHA-256 hashes
- Private IPs blocked (SSRF protection)
- HTTPS enforced for all webhook URLs
- Delivery logs limited to last 10KB of response
- Failed deliveries tracked, webhooks auto-disabled after repeated failures
