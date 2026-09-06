# Discord.js Command Patterns

Reference for creating different types of commands.

## Slash Commands (Chat Input Commands)

### Basic Slash Command

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),
  
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply('Pong!');
  },
};

export default command;
```

### Command with Options

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Echoes your message')
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('The message to echo')
        .setRequired(true)
        .setMaxLength(2000)
    )
    .addBooleanOption(option =>
      option
        .setName('ephemeral')
        .setDescription('Whether the response should be ephemeral')
        .setRequired(false)
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const message = interaction.options.getString('message', true);
    const ephemeral = interaction.options.getBoolean('ephemeral') ?? false;
    
    await interaction.reply({ content: message, ephemeral });
  },
};

export default command;
```

### Command with User Mention

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Get user avatar')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to get avatar for')
        .setRequired(false)
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const avatarUrl = user.displayAvatarURL({ size: 4096 });
    
    await interaction.reply(avatarUrl);
  },
};

export default command;
```

### Command with Channel Selection

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction, ChannelType } from 'discord.js';
import type { Command } from '../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send an announcement')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to send announcement to')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('Announcement message')
        .setRequired(true)
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.getChannel('channel', true);
    const message = interaction.options.getString('message', true);
    
    // Type assertion needed for channel operations
    const textChannel = await interaction.guild?.channels.fetch(channel.id);
    if (textChannel?.isTextBased()) {
      await textChannel.send(message);
      await interaction.reply({ content: 'Announcement sent!', ephemeral: true });
    }
  },
};

export default command;
```

### Command with Subcommands

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('moderation')
    .setDescription('Moderation commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('ban')
        .setDescription('Ban a user')
        .addUserOption(option =>
          option.setName('user').setDescription('User to ban').setRequired(true)
        )
        .addStringOption(option =>
          option.setName('reason').setDescription('Ban reason').setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('kick')
        .setDescription('Kick a user')
        .addUserOption(option =>
          option.setName('user').setDescription('User to kick').setRequired(true)
        )
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'ban': {
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') ?? 'No reason provided';
        await interaction.reply(`Banning ${user.tag} for: ${reason}`);
        break;
      }
      case 'kick': {
        const user = interaction.options.getUser('user', true);
        await interaction.reply(`Kicking ${user.tag}`);
        break;
      }
    }
  },
};

export default command;
```

### Command with Choices

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('color')
    .setDescription('Set your favorite color')
    .addStringOption(option =>
      option
        .setName('color')
        .setDescription('Your favorite color')
        .setRequired(true)
        .addChoices(
          { name: 'Red', value: 'red' },
          { name: 'Green', value: 'green' },
          { name: 'Blue', value: 'blue' }
        )
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const color = interaction.options.getString('color', true);
    await interaction.reply(`Your favorite color is ${color}!`);
  },
};

export default command;
```

## Context Menu Commands

### User Context Menu

```typescript
import { ContextMenuCommandBuilder, ApplicationCommandType, UserContextMenuCommandInteraction } from 'discord.js';
import type { Command } from '../types/index.js';

const command: Command = {
  data: new ContextMenuCommandBuilder()
    .setName('Get Avatar')
    .setType(ApplicationCommandType.User),
  
  async execute(interaction: UserContextMenuCommandInteraction) {
    const user = interaction.targetUser;
    const avatarUrl = user.displayAvatarURL({ size: 4096 });
    
    await interaction.reply(avatarUrl);
  },
};

export default command;
```

### Message Context Menu

```typescript
import { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction } from 'discord.js';
import type { Command } from '../types/index.js';

const command: Command = {
  data: new ContextMenuCommandBuilder()
    .setName('Pin Message')
    .setType(ApplicationCommandType.Message),
  
  async execute(interaction: MessageContextMenuCommandInteraction) {
    const message = interaction.targetMessage;
    await message.pin();
    await interaction.reply({ content: 'Message pinned!', ephemeral: true });
  },
};

export default command;
```

## Option Types Reference

| Option Type | Method | Return Type |
|-------------|--------|-------------|
| String | `getString(name, required?)` | `string \| null` |
| Integer | `getInteger(name, required?)` | `number \| null` |
| Number | `getNumber(name, required?)` | `number \| null` |
| Boolean | `getBoolean(name, required?)` | `boolean \| null` |
| User | `getUser(name, required?)` | `User \| null` |
| Member | `getMember(name, required?)` | `GuildMember \| null` |
| Channel | `getChannel(name, required?)` | `Channel \| null` |
| Role | `getRole(name, required?)` | `Role \| null` |
| Mentionable | `getMentionable(name, required?)` | `User \| Role \| null` |
| Attachment | `getAttachment(name, required?)` | `Attachment \| null` |

## Command Validation

```typescript
// Check permissions
if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
  return interaction.reply({ 
    content: 'You need Administrator permission to use this command!', 
    ephemeral: true 
  });
}

// Check bot permissions
const botMember = interaction.guild?.members.me;
if (!botMember?.permissions.has(PermissionFlagsBits.BanMembers)) {
  return interaction.reply({ 
    content: 'I need Ban Members permission to use this command!', 
    ephemeral: true 
  });
}

// Check if in guild
if (!interaction.inGuild()) {
  return interaction.reply({ 
    content: 'This command can only be used in a server!', 
    ephemeral: true 
  });
}
```
