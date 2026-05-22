---
title: "Reaction Roles Module"
description: "Self-assignable roles via reactions, buttons or dropdowns."
---

## Purpose

Reaction Roles let server members self-assign roles by interacting with a pinned message. Three interaction types are supported:

- **Reactions** — classic emoji reaction (✅, 🎮, etc.)
- **Buttons** — Discord button components
- **Dropdown** — Discord select menu (up to 25 options per menu)

Each role mapping can have one of four behavior modes:

- **Toggle** — clicking adds the role; clicking again removes it
- **Add Only** — clicking only grants the role (no removal)
- **Remove Only** — clicking only removes the role (no grant)
- **Unique** — clicking grants the role and removes all other roles in the same group (radio-button style)

## Dashboard Location

- Page: `/dashboard/[guildId]/reaction-roles`

## API Endpoints

- `GET /api/guilds/[guildId]/reaction-roles` — list all reaction role messages
- `POST /api/guilds/[guildId]/reaction-roles` — create a new reaction role message
- `PATCH /api/guilds/[guildId]/reaction-roles/[messageId]` — update an existing message
- `DELETE /api/guilds/[guildId]/reaction-roles/[messageId]` — delete a reaction role message

## Database Tables

- `reaction_role_message` — top-level message configurations (channel, title, description, component type)
- `reaction_role` — individual role mappings (role ID, emoji, description, behavior type)

## Related Bot Code

- Event: `src/bot/events/interactionCreate.ts` (handles button/select interactions)
- Event: `src/bot/events/messageReactionAdd.ts` and `messageReactionRemove.ts` (handles emoji reactions)

## Typical Workflow

1. Open the **Reaction Roles** page in the dashboard.
2. Click **Create Reaction Role**.
3. Select component type: **Reactions**, **Buttons**, or **Dropdown**.
4. Configure the message:
   - **Channel**: Where the message will be posted.
   - **Title**: Title text displayed on the message.
   - **Description**: Body content of the message.
5. Add one or more role mappings:
   - Choose a role from the dropdown.
   - Choose an emoji (required for Reactions and Buttons).
   - Add a description (shown for Buttons and Dropdown items).
   - Set the behavior type: Toggle, Add Only, Remove Only, or Unique.
6. Click **Post** to send the message to the selected channel.
7. Members interact with the message to self-assign roles.

## Common Failure Modes

- **Bot missing Manage Roles permission**: The bot must have `Manage Roles` and be above the target roles in the role hierarchy.
- **Reactions not working after bot restart**: The bot uses persistent component listeners; emoji reactions require the `GuildMessageReactions` intent to be enabled in the Discord Developer Portal.
- **Message was deleted manually**: If the Discord message is deleted outside the dashboard, the database entry will become orphaned. Delete it from the dashboard to clean up.
- **Dropdown exceeds 25 options**: Discord limits select menus to 25 options. Split into multiple messages if needed.

## Cross-References

- Dashboard overview: [docs/DASHBOARD.md](/docs/dashboard)
- Commands: [docs/COMMANDS.md](/docs/commands)
- Role Actions (automated role-triggered actions): [role-actions.md](/docs/modules/role-actions)
