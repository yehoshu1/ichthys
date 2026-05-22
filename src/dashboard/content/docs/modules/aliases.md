---
title: "Message Aliases (Auto-Responder)"
description: "Trigger-word auto-responders."
---

The Message Aliases module allows you to create custom trigger words that the bot responds to automatically. When a user types a configured trigger word, the bot sends a predefined response.

## Overview

Message aliases are useful for:
- Quick server rules lookup (`!rules`)
- Help command responses (`!help`)
- FAQ answers (`!faq`)
- Server invite links (`!invite`)
- Social media links (`!socials`)

## Configuration

Navigate to **Dashboard > Aliases** to manage message aliases.

### Creating an Alias

1. Click **"Add Alias"**
2. Configure the trigger word (e.g., `rules`, `help`, `faq`)
3. Set the response message
4. Optional: Add a Discord embed in JSON format
5. Configure behavior settings:
   - **Prefix**: Require `!`, `.`, or no prefix
   - **Cooldown**: Per-user cooldown to prevent spam
   - **Channel Restrictions**: Limit to specific channels
   - **Role Restrictions**: Require specific roles to use
6. Toggle **Delete Trigger** to auto-delete the trigger message

### Alias Settings

| Setting | Description |
|---------|-------------|
| Trigger | The word that triggers the bot response (max 50 chars) |
| Response | Message content the bot sends (supports Discord markdown) |
| Embed | Optional rich embed in JSON format |
| Prefix | Require a prefix like `!`, `.`, or none |
| Cooldown | Seconds between uses per user (0-3600) |
| Case Sensitive | Require exact capitalization |
| Delete Trigger | Remove the triggering message |
| Allowed Channels | Restrict to specific channels (empty = all) |
| Allowed Roles | Require specific roles (empty = all) |

### Embed Format

Optional rich embeds use Discord's embed JSON format:

```json
{
  "title": "Server Rules",
  "description": "Please follow these rules...",
  "color": 3447003,
  "fields": [
    {
      "name": "Rule 1",
      "value": "Be respectful"
    }
  ]
}
```

## Usage Examples

### Basic Rule Alias

- **Trigger**: `rules`
- **Prefix**: `!`
- **Response**: Check <#rules-channel> for our server rules!

User types: `!rules` → Bot responds with the message

### FAQ with Embed

- **Trigger**: `faq`
- **Prefix**: `!`
- **Embed**: Rich embed with formatted FAQ

User types: `!faq` → Bot responds with formatted embed

### Support Alias (Role Restricted)

- **Trigger**: `support`
- **Prefix**: `!`
- **Response**: Contact our support team...
- **Allowed Roles**: `@Support Team`

Only users with the Support Team role can use this alias

## Dashboard Features

- **List View**: See all aliases with trigger, response preview, and usage stats
- **Search**: Filter by trigger word or response content
- **Quick Toggle**: Enable/disable aliases from the list
- **Edit/Delete**: Modify or remove existing aliases
- **Usage Counter**: Track how often each alias is used

## Permissions

- **Manage Server** permission required to create/edit aliases
- Regular members can use aliases based on role/channel restrictions

## Best Practices

1. **Use prefixes** to avoid accidental triggers (e.g., `!rules` vs `rules`)
2. **Set cooldowns** to prevent spam (5-30 seconds recommended)
3. **Keep responses concise** for better readability
4. **Use embeds** for rich formatting and visual appeal
5. **Organize triggers** with consistent naming conventions
6. **Test aliases** before enabling for everyone

## Technical Notes

- Aliases are checked in the order they were created
- First matching alias is triggered; others are ignored
- Cooldowns are per-user, not global
- Trigger deletion requires "Manage Messages" permission
- Maximum 2000 characters for response text
- Maximum 50 characters for trigger word
