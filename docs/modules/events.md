# Events Module

The Events module allows server administrators to create, manage, and track server events with RSVP functionality.

## Features

- **Event Creation**: Create events with title, description, time, location
- **RSVP Tracking**: Track Yes/No/Maybe/Waitlist responses
- **Recurring Events**: Support for daily, weekly, bi-weekly, monthly, yearly recurrence
- **Role Restrictions**: Limit attendance by role (required/blocked roles)
- **Auto-Assign Roles**: Automatically give roles to attendees
- **Waitlist Management**: Automatic promotion when spots open
- **Event Templates**: Save and reuse common event configurations
- **Color Coding**: Visual distinction for different event types

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `event` | Core event data |
| `event_rsvp` | RSVP responses per user |
| `event_reminder` | User reminder preferences |
| `event_template` | Reusable event templates |
| `event_poll_settings` | Server-wide event/poll settings |

### Event Status
- `SCHEDULED` - Event is upcoming
- `ACTIVE` - Event is currently happening
- `COMPLETED` - Event has ended
- `CANCELLED` - Event was cancelled

### RSVP Status
- `YES` - Attending
- `NO` - Not attending
- `MAYBE` - Maybe attending
- `WAITLIST` - Waiting for spot

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/guilds/[guildId]/events` | GET | List events with RSVP counts |
| `/api/guilds/[guildId]/events` | POST | Create new event |
| `/api/guilds/[guildId]/events/[eventId]` | GET | Get event details with RSVPs |
| `/api/guilds/[guildId]/events/[eventId]` | PATCH | Update event |
| `/api/guilds/[guildId]/events/[eventId]` | DELETE | Delete event |
| `/api/guilds/[guildId]/events/templates` | GET/POST | Event templates |
| `/api/guilds/[guildId]/events/settings` | GET/POST | Event settings |

## Bot Commands

- `/event create` - Create a new event
- `/event list` - List upcoming events
- `/event info [id]` - Get event details
- `/event edit [id]` - Edit an event
- `/event cancel [id]` - Cancel an event
- `/rsvp [event] [status]` - RSVP to an event

## Webhook Events

| Event | Description |
|-------|-------------|
| `event.created` | New event created |
| `event.updated` | Event details changed |
| `event.deleted` | Event removed |
| `event.started` | Event start time reached |
| `rsvp.yes` | User RSVP'd yes |
| `rsvp.no` | User RSVP'd no |
| `rsvp.maybe` | User RSVP'd maybe |
| `rsvp.waitlist` | User added to waitlist |

## Implementation Details

### Race Condition Protection
The waitlist promotion uses database transactions to prevent race conditions when multiple users cancel simultaneously:
```typescript
return await db.transaction(async (tx) => {
    // Check current count within transaction
    const [countResult] = await tx.select({ count: ... });
    if (countResult.count >= maxAttendees) return null;
    // Promote first waitlisted user
});
```

### Recurring Events
- Maximum 52 instances allowed (~1 year weekly)
- Instances are created at creation time, not dynamically
- Parent event tracks the series

### Input Validation
- Title: max 100 characters
- Description: max 2000 characters
- Location: max 100 characters
- Max attendees: 0-1000

## Security Considerations

- Only users with Manage Server permission can create events via dashboard
- Role restrictions are enforced at the Discord interaction level
- Event creator can always RSVP regardless of restrictions
