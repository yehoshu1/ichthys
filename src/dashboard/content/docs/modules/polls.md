---
title: "Polls Module"
description: "Standard, time and anonymous polls."
---

The Polls module provides flexible polling capabilities including standard polls, time polls (When2meet-style), and anonymous voting.

## Features

- **Standard Polls**: Multiple choice voting with customizable options
- **Time Polls**: Schedule events by voting on time slots
- **Anonymous Polls**: Hidden voter identities for sensitive topics
- **Multiple Votes**: Allow users to vote for multiple options
- **Custom Options**: Let users add their own options
- **Role Restrictions**: Limit voting to specific roles
- **End Time**: Auto-close polls at specific times
- **Poll Templates**: Save and reuse poll configurations

## Poll Types

### Standard Poll
- Multiple choice options
- Optional emojis for each option
- Visual bar chart results

### Time Poll
- Generates time slot options automatically
- Configurable duration (30m, 1h, 1.5h, 2h, 3h, 4h)
- Date range selection
- Time range selection (earliest to latest)

### Anonymous Poll
- Voter identities hidden from results
- User IDs hashed with HMAC-SHA256 before storage
- Cannot be de-anonymized even with database access

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `poll` | Core poll data |
| `poll_option` | Poll choices/options |
| `poll_vote` | User votes (hashed for anonymous) |
| `poll_template` | Reusable poll templates |

### Poll Type Enum
- `STANDARD` - Regular multiple choice
- `TIME` - Time slot scheduling
- `ANONYMOUS` - Hidden voter identities

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/guilds/[guildId]/polls` | GET | List polls with vote counts |
| `/api/guilds/[guildId]/polls` | POST | Create new poll |
| `/api/guilds/[guildId]/polls/[pollId]` | GET | Get poll with options and votes |
| `/api/guilds/[guildId]/polls/[pollId]` | PATCH | Update poll |
| `/api/guilds/[guildId]/polls/[pollId]` | DELETE | Delete poll |
| `/api/guilds/[guildId]/polls/[pollId]/results` | GET | Get poll results |
| `/api/guilds/[guildId]/polls/templates` | GET/POST | Poll templates |

## Bot Commands

- `/poll create` - Create a new poll
- `/poll create time` - Create a time poll
- `/poll close [id]` - Close a poll early
- `/poll results [id]` - View poll results

## Webhook Events

| Event | Description |
|-------|-------------|
| `poll.created` | New poll created |
| `poll.voted` | User cast a vote |
| `poll.closed` | Poll ended (automatic or manual) |

## Anonymous Voting Implementation

Anonymous votes use HMAC-SHA256 hashing to protect voter privacy:

```typescript
function anonymizeUserId(userId: string, pollId: string): string {
    return crypto
        .createHmac('sha256', process.env.ANONYMIZE_SECRET)
        .update(`${pollId}:${userId}`)
        .digest('hex');
}
```

- Same user voting in same poll = same hash
- Same user in different polls = different hashes
- Cannot reverse hash to get original userId
- Database only stores hashed values

## Input Validation

- Question: max 256 characters
- Description: max 1000 characters
- Options: max 20
- Option text: max 100 characters
- Max votes per user: 1-20, cannot exceed number of options

## Security Considerations

- Anonymous polls: Even database admins cannot see who voted
- Role restrictions checked at Discord interaction level
- Vote counts are accurate but voter lists hidden for anonymous polls
- Users can only vote once per option (toggle to remove vote)
