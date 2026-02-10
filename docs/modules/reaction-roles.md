# Reaction Roles Module

## Purpose

Reaction Roles lets members self-assign roles using reactions on designated messages. The dashboard now supports creating and sending messages directly from the web interface - no need to manually create messages in Discord!

Supported behaviors:

- `TOGGLE` - Members can toggle the role on/off by reacting/unreacting
- `ADD_ONLY` - Role can only be added, not removed via reaction
- `REMOVE_ONLY` - Role can only be removed, not added via reaction  
- `UNIQUE` - Member can only have one role from this message (e.g., color roles)

## Dashboard Location

- Page: `/dashboard/[guildId]/reaction-roles`

## Dashboard Interface

The Reaction Roles dashboard has two tabs:

### Messages Tab
Create and manage messages that will be sent to Discord for reaction roles.

**Creating a Message:**
1. Click "Create Message"
2. Select the target channel
3. Add an optional title
4. Enter message content (supports Discord markdown)
5. Optionally enable and configure an embed:
   - Title, description, color
   - Fields, footer, images
6. Save the message

**Sending to Discord:**
- After creating, click "Send to Discord" to post the message
- Once sent, the message shows a "Sent" badge
- You can update the message content and click "Update in Discord" to edit

**Managing Messages:**
- Edit message content anytime
- Delete messages (also removes from Discord if sent)
- View how many reaction roles are attached to each message
- Quick "Add Role" button to add reaction roles to a message

### Roles Tab
Manage emoji-to-role mappings for your messages.

**Adding a Reaction Role:**
1. Select the message (must be created first)
2. Choose the emoji (Unicode or custom emoji format)
3. Select the role to assign
4. Choose the reaction type (TOGGLE, ADD_ONLY, REMOVE_ONLY, UNIQUE)
5. Add an optional description
6. Save

**Note:** The message must be sent to Discord before reactions will work. The bot automatically adds the emoji reactions to the message.

## API Endpoints

### Messages
- `GET/POST /api/guilds/[guildId]/reaction-roles/messages` - List/create messages
- `PATCH /api/guilds/[guildId]/reaction-roles/messages` - Send/update message in Discord
- `DELETE /api/guilds/[guildId]/reaction-roles/messages?id=<id>` - Delete message

### Reaction Roles
- `GET/POST /api/guilds/[guildId]/reaction-roles` - List/create reaction role mappings
- `DELETE /api/guilds/[guildId]/reaction-roles?id=<id>` - Delete reaction role mapping

### Shared Discord Data
- `GET /api/guilds/[guildId]/discord-data` - Fetch roles and channels

## Database Tables

- `reaction_role_message` - Stores message content, embeds, and Discord message IDs
- `reaction_role` - Stores emoji-to-role mappings and behavior settings

## Related Bot Code

- Event listener: `src/bot/events/messageReactionAdd.ts`
- Event listener: `src/bot/events/messageReactionRemove.ts`

## Complete Workflow

### Creating Reaction Roles from Dashboard:

1. **Create Message**
   - Go to Messages tab
   - Click "Create Message"
   - Design your message with content and/or embed
   - Select target channel
   - Save

2. **Send to Discord**
   - Click "Send to Discord" button
   - Bot posts the message in the selected channel
   - Message gets a "Sent" badge

3. **Add Reaction Roles**
   - Switch to Roles tab (or click "Add Role" on a message)
   - Select your message
   - Choose emoji and role
   - Set reaction type
   - Save

4. **Bot Adds Reactions**
   - Bot automatically reacts to the message with configured emojis
   - Members can now click to get roles

5. **Test**
   - Use a non-admin test account
   - Click reactions on the message
   - Verify role assignment works

## Configuration Options

### Message Options
| Option | Description |
|--------|-------------|
| Channel | Where to send the message |
| Title | Optional header for the message |
| Content | Main message text (supports Discord markdown) |
| Embed | Optional rich embed with color, fields, images |

### Reaction Role Options
| Option | Description |
|--------|-------------|
| Message | Which message to attach the reaction to |
| Emoji | Unicode emoji or custom emoji ID |
| Role | Role to assign when user reacts |
| Type | Behavior: TOGGLE, ADD_ONLY, REMOVE_ONLY, UNIQUE |
| Description | Optional explanation shown in dashboard |

## Common Failure Modes

- **Message not sending:**
  - Bot missing `Send Messages` permission in channel
  - Bot missing `Embed Links` permission (if using embeds)

- **Reaction mapping saves but role not applied:**
  - Bot missing `Manage Roles` permission
  - Target role is above bot's highest role
  - Bot cannot react to the message (missing `Add Reactions`)

- **Message not found:**
  - Message was deleted from Discord
  - Wrong channel selected

- **Duplicate emoji mapping:**
  - Each message+emoji combination must be unique
  - Edit existing mapping instead

- **Reactions not appearing:**
  - Message not sent to Discord yet
  - Bot was offline when reaction roles were added
  - Re-add reaction roles to trigger bot reactions

## Best Practices

1. **Create descriptive messages** - Clearly explain what each reaction does
2. **Use consistent emojis** - Related roles should use related emojis
3. **Test before announcing** - Verify all reactions work with a test account
4. **Limit roles per message** - Too many reactions can be overwhelming (max 20 per message)
5. **Use UNIQUE for mutually exclusive roles** - Like color roles or team assignments
6. **Keep message updated** - If you add/remove roles, update the message content too
