# Discord.js Event Patterns

Reference for handling Discord events.

## Common Events

### Client Ready

```typescript
import { Events, Client } from 'discord.js';
import type { Event } from '../types/index.js';

const event: Event = {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client) {
    console.log(`Ready! Logged in as ${client.user?.tag}`);
    console.log(`Serving ${client.guilds.cache.size} guilds`);
  },
};

export default event;
```

### Guild Create/Delete

```typescript
import { Events, Guild } from 'discord.js';
import type { Event } from '../types/index.js';

// Bot joins a guild
const event: Event = {
  name: Events.GuildCreate,
  async execute(guild: Guild) {
    console.log(`Joined guild: ${guild.name} (${guild.id})`);
    // Initialize guild settings in database
  },
};

// Bot leaves a guild
const event: Event = {
  name: Events.GuildDelete,
  async execute(guild: Guild) {
    console.log(`Left guild: ${guild.name} (${guild.id})`);
    // Clean up guild data
  },
};
```

### Message Events

```typescript
import { Events, Message } from 'discord.js';
import type { Event } from '../types/index.js';

const event: Event = {
  name: Events.MessageCreate,
  async execute(message: Message) {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Ignore DMs (optional)
    if (!message.inGuild()) return;
    
    // Log messages
    console.log(`${message.author.tag}: ${message.content}`);
    
    // XP/Leveling system
    // await addXP(message.author.id, message.guild.id, 1);
  },
};

export default event;
```

### Guild Member Events

```typescript
import { Events, GuildMember, PartialGuildMember } from 'discord.js';
import type { Event } from '../types/index.js';

// Member joins guild
const event: Event = {
  name: Events.GuildMemberAdd,
  async execute(member: GuildMember) {
    console.log(`${member.user.tag} joined ${member.guild.name}`);
    
    // Send welcome message
    const welcomeChannel = member.guild.systemChannel;
    if (welcomeChannel) {
      await welcomeChannel.send(`Welcome ${member} to ${member.guild.name}!`);
    }
    
    // Assign default role
    const defaultRole = member.guild.roles.cache.find(r => r.name === 'Member');
    if (defaultRole) {
      await member.roles.add(defaultRole);
    }
  },
};

// Member leaves guild
const event: Event = {
  name: Events.GuildMemberRemove,
  async execute(member: GuildMember | PartialGuildMember) {
    console.log(`${member.user?.tag} left ${member.guild.name}`);
  },
};

// Member updated (roles, nickname, etc.)
const event: Event = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
    // Check for role changes
    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
    
    if (addedRoles.size > 0) {
      console.log(`Roles added to ${newMember.user.tag}: ${addedRoles.map(r => r.name).join(', ')}`);
    }
    
    if (removedRoles.size > 0) {
      console.log(`Roles removed from ${newMember.user.tag}: ${removedRoles.map(r => r.name).join(', ')}`);
    }
    
    // Check nickname change
    if (oldMember.nickname !== newMember.nickname) {
      console.log(`${newMember.user.tag} changed nickname: ${oldMember.nickname} -> ${newMember.nickname}`);
    }
  },
};
```

### Interaction Events

```typescript
import { Events, Interaction } from 'discord.js';
import type { Event, BotClient } from '../types/index.js';

// Chat input commands
const event: Event = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;
    
    const client = interaction.client as BotClient;
    const command = client.commands.get(interaction.commandName);
    
    if (!command) return;
    
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      const content = 'There was an error executing this command!';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, ephemeral: true });
      } else {
        await interaction.reply({ content, ephemeral: true });
      }
    }
  },
};

// Button/Select Menu/Modal interactions
const event: Event = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    // Handle buttons
    if (interaction.isButton()) {
      const [action, ...params] = interaction.customId.split(':');
      
      switch (action) {
        case 'confirm':
          await interaction.reply('Confirmed!');
          break;
        case 'cancel':
          await interaction.reply('Cancelled!');
          break;
      }
    }
    
    // Handle select menus
    if (interaction.isStringSelectMenu()) {
      const selected = interaction.values;
      await interaction.reply(`You selected: ${selected.join(', ')}`);
    }
    
    // Handle modals
    if (interaction.isModalSubmit()) {
      const input = interaction.fields.getTextInputValue('input_id');
      await interaction.reply(`You submitted: ${input}`);
    }
  },
};
```

### Voice State Events

```typescript
import { Events, VoiceState } from 'discord.js';
import type { Event } from '../types/index.js';

const event: Event = {
  name: Events.VoiceStateUpdate,
  async execute(oldState: VoiceState, newState: VoiceState) {
    const member = newState.member;
    if (!member) return;
    
    // User joined a voice channel
    if (!oldState.channel && newState.channel) {
      console.log(`${member.user.tag} joined ${newState.channel.name}`);
      
      // Track voice time for leveling
      // await startVoiceTracking(member.id, member.guild.id);
    }
    
    // User left a voice channel
    if (oldState.channel && !newState.channel) {
      console.log(`${member.user.tag} left ${oldState.channel.name}`);
      
      // Stop voice tracking
      // await endVoiceTracking(member.id, member.guild.id);
    }
    
    // User moved between channels
    if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
      console.log(`${member.user.tag} moved from ${oldState.channel.name} to ${newState.channel.name}`);
    }
    
    // Screen share started/stopped
    if (!oldState.streaming && newState.streaming) {
      console.log(`${member.user.tag} started streaming`);
    }
    if (oldState.streaming && !newState.streaming) {
      console.log(`${member.user.tag} stopped streaming`);
    }
    
    // Video camera on/off
    if (!oldState.selfVideo && newState.selfVideo) {
      console.log(`${member.user.tag} turned on camera`);
    }
    if (oldState.selfVideo && !newState.selfVideo) {
      console.log(`${member.user.tag} turned off camera`);
    }
  },
};
```

### Presence/Activity Events

```typescript
import { Events, Presence } from 'discord.js';
import type { Event } from '../types/index.js';

const event: Event = {
  name: Events.PresenceUpdate,
  async execute(oldPresence: Presence | null, newPresence: Presence) {
    const member = newPresence.member;
    if (!member) return;
    
    // Status change (online, idle, dnd, offline)
    if (oldPresence?.status !== newPresence.status) {
      console.log(`${member.user.tag} is now ${newPresence.status}`);
    }
    
    // Activity change
    const newActivities = newPresence.activities;
    const oldActivities = oldPresence?.activities ?? [];
    
    // Started playing a game
    for (const activity of newActivities) {
      if (!oldActivities.find(a => a.name === activity.name)) {
        console.log(`${member.user.tag} started ${activity.type === 0 ? 'playing' : 'doing'} ${activity.name}`);
      }
    }
    
    // Stopped playing a game
    for (const activity of oldActivities) {
      if (!newActivities.find(a => a.name === activity.name)) {
        console.log(`${member.user.tag} stopped ${activity.name}`);
      }
    }
  },
};
```

### Reaction Events

```typescript
import { Events, MessageReaction, User } from 'discord.js';
import type { Event } from '../types/index.js';

// Reaction added
const event: Event = {
  name: Events.MessageReactionAdd,
  async execute(reaction: MessageReaction, user: User) {
    // Handle partial reactions
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        console.error('Failed to fetch reaction:', error);
        return;
      }
    }
    
    if (user.bot) return;
    
    console.log(`${user.tag} reacted with ${reaction.emoji.name} to message ${reaction.message.id}`);
    
    // Starboard logic
    if (reaction.emoji.name === '⭐' && reaction.count >= 5) {
      // Add to starboard
    }
  },
};

// Reaction removed
const event: Event = {
  name: Events.MessageReactionRemove,
  async execute(reaction: MessageReaction, user: User) {
    console.log(`${user.tag} removed ${reaction.emoji.name} reaction`);
  },
};
```

## Error Handling Events

```typescript
import { Events } from 'discord.js';
import type { Event } from '../types/index.js';

const event: Event = {
  name: Events.Error,
  async execute(error: Error) {
    console.error('Discord client error:', error);
  },
};

// Warn event
const event: Event = {
  name: Events.Warn,
  async execute(info: string) {
    console.warn('Discord client warning:', info);
  },
};

// Debug event (development only)
const event: Event = {
  name: Events.Debug,
  async execute(info: string) {
    if (process.env.NODE_ENV === 'development') {
      console.log('Debug:', info);
    }
  },
};
```

## Event Reference Table

| Event | Description | Parameters |
|-------|-------------|------------|
| `ClientReady` | Bot is ready | `client: Client` |
| `GuildCreate` | Bot joins guild | `guild: Guild` |
| `GuildDelete` | Bot leaves guild | `guild: Guild` |
| `GuildMemberAdd` | User joins guild | `member: GuildMember` |
| `GuildMemberRemove` | User leaves guild | `member: GuildMember \| PartialGuildMember` |
| `GuildMemberUpdate` | Member info changes | `oldMember, newMember` |
| `MessageCreate` | New message sent | `message: Message` |
| `MessageDelete` | Message deleted | `message: Message \| PartialMessage` |
| `MessageUpdate` | Message edited | `oldMessage, newMessage` |
| `InteractionCreate` | Any interaction | `interaction: Interaction` |
| `VoiceStateUpdate` | Voice state changes | `oldState, newState` |
| `PresenceUpdate` | Presence changes | `oldPresence, newPresence` |
| `MessageReactionAdd` | Reaction added | `reaction, user` |
| `MessageReactionRemove` | Reaction removed | `reaction, user` |
