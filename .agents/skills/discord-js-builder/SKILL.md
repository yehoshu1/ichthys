---
name: discord-js-builder
description: Build Discord bots using Discord.js v14 and TypeScript. Use when creating new Discord bots, adding slash commands, handling events, creating interactive components (buttons, select menus, modals), building embeds, or deploying Discord bots. Supports command registration, message components, voice features, and production deployment patterns.
---

# Discord.js Builder Skill

This skill provides workflows and patterns for building Discord bots with Discord.js v14, TypeScript, and Bun runtime.

## Quick Start

### 1. Create a New Bot Project

Copy the bot template to your project directory:

```bash
# Copy template files
cp -r ~/.config/agents/skills/discord-js-builder/assets/bot-template/* ./my-discord-bot/
cd my-discord-bot

# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Edit .env with your Discord credentials
```

### 2. Configure Environment Variables

Edit `.env`:

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
DISCORD_GUILD_ID=your_test_guild_id
```

### 3. Create Your First Command

```typescript
// src/commands/hello.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('hello')
    .setDescription('Say hello')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to greet')
        .setRequired(false)
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    await interaction.reply(`Hello, ${user}! 👋`);
  },
};

export default command;
```

### 4. Deploy Commands

```bash
# Deploy to test guild (instant)
bun run deploy

# Deploy globally (takes up to 1 hour)
bun run deploy -- --global
```

### 5. Start the Bot

```bash
# Development (hot reload)
bun run dev

# Production
bun run build
npm start
```

## Core Concepts

### Command Structure

Every command must export a `Command` object with:
- `data`: `SlashCommandBuilder` or `ContextMenuCommandBuilder`
- `execute`: Function to handle the interaction

```typescript
import type { Command } from '../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()...,
  async execute(interaction) { ... },
};
```

### Event Structure

Events are auto-loaded from `src/events/`:

```typescript
import type { Event } from '../types/index.js';

const event: Event = {
  name: Events.MessageCreate,
  once: false,  // Set to true for one-time events like ClientReady
  async execute(message) { ... },
};
```

### Interaction Types

```typescript
// Check interaction type
interaction.isChatInputCommand()
interaction.isButton()
interaction.isStringSelectMenu()
interaction.isUserSelectMenu()
interaction.isRoleSelectMenu()
interaction.isChannelSelectMenu()
interaction.isMentionableSelectMenu()
interaction.isModalSubmit()
interaction.isAnySelectMenu()
```

## Reference Guides

| Topic | File | Use When |
|-------|------|----------|
| **Commands** | [references/commands.md](references/commands.md) | Creating slash commands, context menus, options, subcommands |
| **Events** | [references/events.md](references/events.md) | Handling Discord events (messages, members, voice, etc.) |
| **Components** | [references/components.md](references/components.md) | Building buttons, select menus, and modals |
| **Embeds** | [references/embeds.md](references/embeds.md) | Creating rich embeds with fields, images, timestamps |
| **Deployment** | [references/deployment.md](references/deployment.md) | Deploying commands, sharding, Docker, PM2 |

## Common Patterns

### Reply Patterns

```typescript
// Simple reply
await interaction.reply('Hello!');

// Ephemeral reply (only visible to user)
await interaction.reply({ content: 'Secret message', ephemeral: true });

// Reply with embed
await interaction.reply({ embeds: [embed] });

// Reply with components
await interaction.reply({ components: [row] });

// Defer reply (for long operations)
await interaction.deferReply();
// ... do work ...
await interaction.editReply('Done!');

// Defer ephemeral
await interaction.deferReply({ ephemeral: true });

// Follow up (after initial reply)
await interaction.followUp('Additional message');

// Update message (for components)
await interaction.update({ content: 'Updated!', components: [] });
```

### Error Handling

```typescript
try {
  await interaction.reply('Processing...');
  // ... do work ...
} catch (error) {
  console.error(error);
  
  const errorMessage = 'An error occurred!';
  
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp({ content: errorMessage, ephemeral: true });
  } else {
    await interaction.reply({ content: errorMessage, ephemeral: true });
  }
}
```

### Permission Checks

```typescript
import { PermissionFlagsBits } from 'discord.js';

// Check user permissions
if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
  return interaction.reply({
    content: 'You need Administrator permission!',
    ephemeral: true,
  });
}

// Check bot permissions
const botMember = interaction.guild?.members.me;
if (!botMember?.permissions.has(PermissionFlagsBits.BanMembers)) {
  return interaction.reply({
    content: 'I need Ban Members permission!',
    ephemeral: true,
  });
}
```

### Fetching Discord Objects

```typescript
// Fetch a guild
const guild = await client.guilds.fetch(guildId);

// Fetch a member
const member = await guild.members.fetch(userId);

// Fetch a user
const user = await client.users.fetch(userId);

// Fetch a channel
const channel = await client.channels.fetch(channelId);

// Fetch a role
const role = await guild.roles.fetch(roleId);

// Fetch messages
const messages = await channel.messages.fetch({ limit: 100 });
```

## Intents Guide

Enable these in the [Discord Developer Portal](https://discord.com/developers/applications) → Bot → Privileged Gateway Intents:

| Intent | Required For | Privileged |
|--------|--------------|------------|
| `Guilds` | Basic functionality | No |
| `GuildMembers` | Member join/leave, fetching members | Yes |
| `GuildMessages` | Message events | No |
| `MessageContent` | Reading message content | Yes |
| `GuildPresences` | Presence/activity updates | Yes |
| `GuildVoiceStates` | Voice channel join/leave | No |

## Project Structure

```
my-discord-bot/
├── src/
│   ├── commands/          # Slash commands
│   ├── events/            # Event handlers
│   ├── types/             # TypeScript types
│   ├── deploy-commands.ts # Command deployment
│   └── index.ts           # Bot entry point
├── dist/                  # Compiled JavaScript
├── package.json
├── tsconfig.json
├── bun.lockb
└── .env
```

## Best Practices

1. **Use TypeScript**: Full type safety with Discord.js
2. **Ephemeral for errors**: Hide error messages from other users
3. **Defer for long operations**: Prevents "interaction failed"
4. **Check permissions**: Always validate before actions
5. **Handle partials**: Use `fetch()` when needed for uncached data
6. **Guild commands for dev**: Faster iteration during development
7. **Global commands for prod**: Persistent across all servers

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Unknown integration" | Deploy commands with `bun run deploy` |
| "Interaction failed" | Use `deferReply()` for operations > 3 seconds |
| Missing message content | Enable `MessageContent` intent + `GatewayIntentBits.MessageContent` |
| Cannot read property of undefined | Check if object exists before accessing properties |
| Commands not appearing | Wait up to 1 hour for global commands, or use guild commands |

## Resources

- [Discord.js Documentation](https://discord.js.org/docs/packages/discord.js/14.25.1)
- [Discord Developer Portal](https://discord.com/developers/docs)
- [Discord API Types](https://discord.js.org/docs/packages/discord-api-types/0.38.38/v10)
