# Discord.js Embed Patterns

Reference for creating rich embeds.

## Basic Embed

```typescript
import { EmbedBuilder } from 'discord.js';

const embed = new EmbedBuilder()
  .setTitle('My Embed Title')
  .setDescription('This is the embed description')
  .setColor(0x0099ff);

await interaction.reply({ embeds: [embed] });
```

## Complete Embed Example

```typescript
import { EmbedBuilder } from 'discord.js';

const embed = new EmbedBuilder()
  // Title and URL
  .setTitle('Discord.js Guide')
  .setURL('https://discord.js.org')
  
  // Author
  .setAuthor({
    name: 'Guide Author',
    iconURL: 'https://i.imgur.com/AfFp7pu.png',
    url: 'https://discord.js.org'
  })
  
  // Description
  .setDescription('A comprehensive guide to building Discord bots')
  
  // Thumbnail
  .setThumbnail('https://i.imgur.com/AfFp7pu.png')
  
  // Fields
  .addFields(
    { name: 'Version', value: '14.x', inline: true },
    { name: 'Language', value: 'TypeScript', inline: true },
    { name: 'Framework', value: 'Node.js', inline: true }
  )
  
  // Image
  .setImage('https://i.imgur.com/AfFp7pu.png')
  
  // Timestamp
  .setTimestamp()
  
  // Footer
  .setFooter({
    text: 'Last updated',
    iconURL: 'https://i.imgur.com/AfFp7pu.png'
  })
  
  // Color
  .setColor(0x0099ff);
```

## Colors

```typescript
import { EmbedBuilder, Colors } from 'discord.js';

// Using predefined colors
EmbedBuilder.setColor(Colors.Red);
EmbedBuilder.setColor(Colors.Green);
EmbedBuilder.setColor(Colors.Blue);
EmbedBuilder.setColor(Colors.Yellow);
EmbedBuilder.setColor(Colors.Purple);
EmbedBuilder.setColor(Colors.Orange);
EmbedBuilder.setColor(Colors.Gold);
EmbedBuilder.setColor(Colors.Aqua);
EmbedBuilder.setColor(Colors.DarkBlue);
EmbedBuilder.setColor(Colors.DarkGreen);
EmbedBuilder.setColor(Colors.DarkRed);
EmbedBuilder.setColor(Colors.DarkButNotBlack);
EmbedBuilder.setColor(Colors.NotQuiteBlack);
EmbedBuilder.setColor(Colors.Default);
EmbedBuilder.setColor(Colors.White);
EmbedBuilder.setColor(Colors.Blurple);
EmbedBuilder.setColor(Colors.Greyple);
EmbedBuilder.setColor(Colors.Fuchsia);
EmbedBuilder.setColor(Colors.Navy);
EmbedBuilder.setColor(Colors.DarkAqua);
EmbedBuilder.setColor(Colors.DarkVividPink);
EmbedBuilder.setColor(Colors.DarkGold);
EmbedBuilder.setColor(Colors.DarkNavy);
EmbedBuilder.setColor(Colors.DarkPurple);
EmbedBuilder.setColor(Colors.DarkerGrey);
EmbedBuilder.setColor(Colors.LightGrey);
EmbedBuilder.setColor(Colors.DarkGrey);
EmbedBuilder.setColor(Colors.LuminousVividPink);

// Using hex color
EmbedBuilder.setColor(0x3498db);  // Blue
EmbedBuilder.setColor(0xe74c3c);  // Red
EmbedBuilder.setColor(0x2ecc71);  // Green
EmbedBuilder.setColor(0xf1c40f);  // Yellow
EmbedBuilder.setColor(0x9b59b6);  // Purple

// Using RGB array
EmbedBuilder.setColor([52, 152, 219]);
```

## Fields

### Basic Fields

```typescript
embed.addFields(
  { name: 'Field 1', value: 'Value 1' },
  { name: 'Field 2', value: 'Value 2' }
);
```

### Inline Fields

```typescript
embed.addFields(
  { name: 'HP', value: '100', inline: true },
  { name: 'MP', value: '50', inline: true },
  { name: 'Level', value: '10', inline: true }
);
// Three inline fields fit on one line
```

### Mixed Fields

```typescript
embed.addFields(
  // Full width field
  { name: 'Character Stats', value: 'Your current stats:' },
  
  // Three inline fields
  { name: 'Strength', value: '18', inline: true },
  { name: 'Dexterity', value: '14', inline: true },
  { name: 'Constitution', value: '16', inline: true },
  
  // Another full width field
  { name: 'Equipment', value: 'Current loadout' }
);
```

### Empty Fields

```typescript
// Create spacing with empty inline fields
embed.addFields(
  { name: 'Left', value: 'Content', inline: true },
  { name: '\u200B', value: '\u200B', inline: true },  // Zero-width space
  { name: 'Right', value: 'Content', inline: true }
);
```

## Common Embed Patterns

### Error Embed

```typescript
function createErrorEmbed(description: string) {
  return new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle('❌ Error')
    .setDescription(description)
    .setTimestamp();
}

await interaction.reply({
  embeds: [createErrorEmbed('Something went wrong!')],
  ephemeral: true,
});
```

### Success Embed

```typescript
function createSuccessEmbed(description: string) {
  return new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle('✅ Success')
    .setDescription(description)
    .setTimestamp();
}
```

### Warning Embed

```typescript
function createWarningEmbed(description: string) {
  return new EmbedBuilder()
    .setColor(Colors.Yellow)
    .setTitle('⚠️ Warning')
    .setDescription(description)
    .setTimestamp();
}
```

### Info Embed

```typescript
function createInfoEmbed(title: string, description: string) {
  return new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle(`ℹ️ ${title}`)
    .setDescription(description)
    .setTimestamp();
}
```

### User Info Embed

```typescript
import { GuildMember, EmbedBuilder, Colors } from 'discord.js';

function createUserInfoEmbed(member: GuildMember) {
  const { user, joinedAt, premiumSince, roles } = member;
  
  return new EmbedBuilder()
    .setColor(member.displayColor || Colors.Default)
    .setTitle(`User Info: ${user.tag}`)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { 
        name: 'User ID', 
        value: user.id, 
        inline: true 
      },
      { 
        name: 'Nickname', 
        value: member.nickname || 'None', 
        inline: true 
      },
      { 
        name: 'Bot', 
        value: user.bot ? 'Yes' : 'No', 
        inline: true 
      },
      { 
        name: 'Created', 
        value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, 
        inline: true 
      },
      { 
        name: 'Joined', 
        value: joinedAt 
          ? `<t:${Math.floor(joinedAt.getTime() / 1000)}:R>` 
          : 'Unknown', 
        inline: true 
      },
      { 
        name: 'Boosting Since', 
        value: premiumSince 
          ? `<t:${Math.floor(premiumSince.getTime() / 1000)}:R>` 
          : 'Not boosting', 
        inline: true 
      },
      { 
        name: `Roles [${roles.cache.size - 1}]`, 
        value: roles.cache.size > 1 
          ? roles.cache.filter(r => r.id !== r.guild.id).map(r => r.toString()).join(', ')
          : 'None'
      }
    )
    .setFooter({ text: `Requested by ${user.tag}` })
    .setTimestamp();
}
```

### Server Info Embed

```typescript
import { Guild, EmbedBuilder, ChannelType } from 'discord.js';

function createServerInfoEmbed(guild: Guild) {
  const owner = guild.members.cache.get(guild.ownerId);
  
  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(guild.name)
    .setThumbnail(guild.iconURL({ size: 256 }))
    .addFields(
      { name: 'Server ID', value: guild.id, inline: true },
      { name: 'Owner', value: owner?.user.tag ?? 'Unknown', inline: true },
      { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'Members', value: guild.memberCount.toString(), inline: true },
      { name: 'Channels', value: guild.channels.cache.size.toString(), inline: true },
      { name: 'Roles', value: guild.roles.cache.size.toString(), inline: true },
      { name: 'Emojis', value: guild.emojis.cache.size.toString(), inline: true },
      { name: 'Boosts', value: guild.premiumSubscriptionCount?.toString() ?? '0', inline: true },
      { name: 'Boost Level', value: `Level ${guild.premiumTier}`, inline: true }
    )
    .setImage(guild.bannerURL({ size: 1024 }))
    .setFooter({ text: `Server created` })
    .setTimestamp(guild.createdAt);
}
```

### Help Menu Embed

```typescript
import { EmbedBuilder, Colors } from 'discord.js';

function createHelpEmbed(commands: { name: string; description: string }[]) {
  const embed = new EmbedBuilder()
    .setColor(Colors.Blurple)
    .setTitle('📚 Bot Commands')
    .setDescription('Here are all available commands:')
    .setTimestamp();
  
  // Group commands by category
  const categories = {
    moderation: commands.filter(cmd => ['ban', 'kick', 'mute'].includes(cmd.name)),
    utility: commands.filter(cmd => ['ping', 'help', 'info'].includes(cmd.name)),
    fun: commands.filter(cmd => !['ban', 'kick', 'mute', 'ping', 'help', 'info'].includes(cmd.name)),
  };
  
  for (const [category, cmds] of Object.entries(categories)) {
    if (cmds.length > 0) {
      embed.addFields({
        name: category.charAt(0).toUpperCase() + category.slice(1),
        value: cmds.map(cmd => `\`/${cmd.name}\` - ${cmd.description}`).join('\n'),
      });
    }
  }
  
  return embed;
}
```

### Music/Queue Embed

```typescript
import { EmbedBuilder, Colors } from 'discord.js';

interface Track {
  title: string;
  artist: string;
  duration: string;
  requestedBy: string;
}

function createQueueEmbed(tracks: Track[], current: number) {
  const embed = new EmbedBuilder()
    .setColor(Colors.Purple)
    .setTitle('🎵 Music Queue');
  
  if (tracks.length === 0) {
    embed.setDescription('The queue is empty.');
    return embed;
  }
  
  // Current track
  const currentTrack = tracks[current];
  embed.addFields({
    name: 'Now Playing',
    value: `**${currentTrack.title}** by ${currentTrack.artist}\n` +
           `Duration: ${currentTrack.duration} | Requested by: ${currentTrack.requestedBy}`,
  });
  
  // Up next
  const upcoming = tracks.slice(current + 1, current + 6);
  if (upcoming.length > 0) {
    embed.addFields({
      name: 'Up Next',
      value: upcoming
        .map((track, i) => `${i + 1}. ${track.title} - ${track.duration}`)
        .join('\n'),
    });
  }
  
  // Queue info
  const remaining = tracks.length - current - 1;
  embed.setFooter({ 
    text: `${tracks.length} tracks in queue | ${remaining} remaining` 
  });
  
  return embed;
}
```

### Paginated Embed

```typescript
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

interface PageData {
  title: string;
  items: string[];
}

function createPaginatedEmbed(
  pages: PageData[], 
  currentPage: number
): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
  const page = pages[currentPage];
  
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(page.title)
    .setDescription(page.items.join('\n'))
    .setFooter({ text: `Page ${currentPage + 1}/${pages.length}` })
    .setTimestamp();
  
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`page:prev:${currentPage}`)
      .setLabel('◀')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === 0),
    new ButtonBuilder()
      .setCustomId(`page:current`)
      .setLabel(`${currentPage + 1}/${pages.length}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`page:next:${currentPage}`)
      .setLabel('▶')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === pages.length - 1)
  );
  
  return { embed, row };
}
```

## Timestamps

```typescript
// Current time
embed.setTimestamp();

// Specific time
embed.setTimestamp(new Date('2024-01-01'));

// Discord timestamp formatting in descriptions
`<t:${Math.floor(Date.now() / 1000)}>`        // Short date time
`<t:${Math.floor(Date.now() / 1000)}:t>`      // Short time
`<t:${Math.floor(Date.now() / 1000)}:T>`      // Long time
`<t:${Math.floor(Date.now() / 1000)}:d>`      // Short date
`<t:${Math.floor(Date.now() / 1000)}:D>`      // Long date
`<t:${Math.floor(Date.now() / 1000)}:f>`      // Short date time (default)
`<t:${Math.floor(Date.now() / 1000)}:F>`      // Long date time
`<t:${Math.floor(Date.now() / 1000)}:R>`      // Relative time
```

## Limits

| Property | Limit |
|----------|-------|
| Title | 256 characters |
| Description | 4096 characters |
| Fields | 25 fields |
| Field Name | 256 characters |
| Field Value | 1024 characters |
| Footer Text | 2048 characters |
| Author Name | 256 characters |
| Total Characters | 6000 characters |
| Embeds per Message | 10 embeds |
