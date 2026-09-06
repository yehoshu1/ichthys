# Discord.js Component Patterns

Reference for creating interactive components (buttons, select menus, modals).

## Buttons

### Basic Button

```typescript
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
    .setCustomId('primary_button')
    .setLabel('Click me!')
    .setStyle(ButtonStyle.Primary)
);

await interaction.reply({
  content: 'Here is a button:',
  components: [row],
});
```

### Button Styles

```typescript
import { ButtonStyle } from 'discord.js';

ButtonStyle.Primary;    // Blurple (blue)
ButtonStyle.Secondary;  // Grey
ButtonStyle.Success;    // Green
ButtonStyle.Danger;     // Red
ButtonStyle.Link;       // Grey with link icon (URL buttons)
```

### Button Types

```typescript
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// Primary button (custom ID for handling)
const primary = new ButtonBuilder()
  .setCustomId('action:confirm')
  .setLabel('Confirm')
  .setStyle(ButtonStyle.Primary);

// Secondary button
const secondary = new ButtonBuilder()
  .setCustomId('action:cancel')
  .setLabel('Cancel')
  .setStyle(ButtonStyle.Secondary);

// Success button
const success = new ButtonBuilder()
  .setCustomId('action:approve')
  .setLabel('Approve')
  .setStyle(ButtonStyle.Success);

// Danger button
const danger = new ButtonBuilder()
  .setCustomId('action:delete')
  .setLabel('Delete')
  .setStyle(ButtonStyle.Danger);

// Link button (no custom ID, uses URL)
const link = new ButtonBuilder()
  .setLabel('View Documentation')
  .setURL('https://discord.js.org')
  .setStyle(ButtonStyle.Link);

// Disabled button
const disabled = new ButtonBuilder()
  .setCustomId('action:disabled')
  .setLabel('Disabled')
  .setStyle(ButtonStyle.Primary)
  .setDisabled(true);

// Button with emoji
const emoji = new ButtonBuilder()
  .setCustomId('action:like')
  .setLabel('Like')
  .setEmoji('👍')
  .setStyle(ButtonStyle.Primary);

// Button with only emoji
const emojiOnly = new ButtonBuilder()
  .setCustomId('action:star')
  .setEmoji('⭐')
  .setStyle(ButtonStyle.Primary);

const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
  primary, secondary, success, danger, link
);
```

### Handling Button Interactions

```typescript
import { Events, ButtonInteraction } from 'discord.js';
import type { Event } from '../types/index.js';

const event: Event = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isButton()) return;
    
    const buttonInteraction = interaction as ButtonInteraction;
    const [action, ...params] = buttonInteraction.customId.split(':');
    
    switch (action) {
      case 'confirm': {
        await buttonInteraction.reply({
          content: 'Action confirmed!',
          ephemeral: true,
        });
        break;
      }
      case 'delete': {
        // Confirm before delete
        await buttonInteraction.reply({
          content: 'Item deleted!',
          ephemeral: true,
        });
        break;
      }
      case 'page': {
        const page = parseInt(params[0]);
        // Handle pagination
        await buttonInteraction.update({
          content: `Page ${page}`,
          components: [getPaginationRow(page)],
        });
        break;
      }
    }
  },
};
```

### Pagination with Buttons

```typescript
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction } from 'discord.js';

function getPaginationRow(currentPage: number, totalPages: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`page:first`)
      .setLabel('<<')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 1),
    new ButtonBuilder()
      .setCustomId(`page:prev:${currentPage}`)
      .setLabel('<')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === 1),
    new ButtonBuilder()
      .setCustomId(`page:info`)
      .setLabel(`${currentPage}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`page:next:${currentPage}`)
      .setLabel('>')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === totalPages),
    new ButtonBuilder()
      .setCustomId(`page:last`)
      .setLabel('>>')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === totalPages)
  );
}

// Usage
await interaction.reply({
  embeds: [getPageEmbed(1)],
  components: [getPaginationRow(1, totalPages)],
});
```

## Select Menus

### String Select Menu

```typescript
import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';

const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
  new StringSelectMenuBuilder()
    .setCustomId('select:color')
    .setPlaceholder('Choose a color')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      { label: 'Red', value: 'red', emoji: '🔴' },
      { label: 'Green', value: 'green', emoji: '🟢' },
      { label: 'Blue', value: 'blue', emoji: '🔵' },
      { label: 'Yellow', value: 'yellow', emoji: '🟡', description: 'Sunny color' },
    )
);

await interaction.reply({
  content: 'Choose your favorite color:',
  components: [selectMenu],
});
```

### Multi-Select Menu

```typescript
const multiSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
  new StringSelectMenuBuilder()
    .setCustomId('select:roles')
    .setPlaceholder('Select roles to assign')
    .setMinValues(0)
    .setMaxValues(3)
    .addOptions(
      { label: 'Announcements', value: 'announcements', description: 'Get notified of announcements' },
      { label: 'Events', value: 'events', description: 'Get notified of events' },
      { label: 'Giveaways', value: 'giveaways', description: 'Get notified of giveaways' },
      { label: 'Updates', value: 'updates', description: 'Get notified of bot updates' },
    )
);
```

### User Select Menu

```typescript
import { ActionRowBuilder, UserSelectMenuBuilder } from 'discord.js';

const userSelect = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
  new UserSelectMenuBuilder()
    .setCustomId('select:user')
    .setPlaceholder('Select a user')
    .setMinValues(1)
    .setMaxValues(1)
);

// Handling
if (interaction.isUserSelectMenu()) {
  const selectedUser = interaction.users.first();
  await interaction.reply(`You selected: ${selectedUser?.tag}`);
}
```

### Role Select Menu

```typescript
import { ActionRowBuilder, RoleSelectMenuBuilder } from 'discord.js';

const roleSelect = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
  new RoleSelectMenuBuilder()
    .setCustomId('select:role')
    .setPlaceholder('Select a role')
    .setMinValues(1)
    .setMaxValues(1)
);

// Handling
if (interaction.isRoleSelectMenu()) {
  const selectedRole = interaction.roles.first();
  await interaction.reply(`You selected role: ${selectedRole?.name}`);
}
```

### Channel Select Menu

```typescript
import { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType } from 'discord.js';

const channelSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
  new ChannelSelectMenuBuilder()
    .setCustomId('select:channel')
    .setPlaceholder('Select a channel')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(1)
    .setMaxValues(1)
);

// Handling
if (interaction.isChannelSelectMenu()) {
  const selectedChannel = interaction.channels.first();
  await interaction.reply(`You selected channel: ${selectedChannel?.name}`);
}
```

### Mentionable Select Menu

```typescript
import { ActionRowBuilder, MentionableSelectMenuBuilder } from 'discord.js';

const mentionableSelect = new ActionRowBuilder<MentionableSelectMenuBuilder>().addComponents(
  new MentionableSelectMenuBuilder()
    .setCustomId('select:mentionable')
    .setPlaceholder('Select users or roles')
    .setMinValues(1)
    .setMaxValues(5)
);

// Handling
if (interaction.isMentionableSelectMenu()) {
  const members = interaction.members; // GuildMembers
  const roles = interaction.roles;     // Roles
  await interaction.reply(`Selected ${members.size} members and ${roles.size} roles`);
}
```

### Handling Select Menu Interactions

```typescript
import { Events } from 'discord.js';
import type { Event } from '../types/index.js';

const event: Event = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isAnySelectMenu()) return;
    
    const [action] = interaction.customId.split(':');
    const selectedValues = interaction.values;
    
    switch (action) {
      case 'select': {
        await interaction.reply({
          content: `You selected: ${selectedValues.join(', ')}`,
          ephemeral: true,
        });
        break;
      }
      case 'roles': {
        // Assign roles based on selection
        await interaction.reply({
          content: `Roles updated!`,
          ephemeral: true,
        });
        break;
      }
    }
  },
};
```

## Modals

### Text Input Modal

```typescript
import { 
  ActionRowBuilder, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle 
} from 'discord.js';

const modal = new ModalBuilder()
  .setCustomId('modal:feedback')
  .setTitle('Submit Feedback');

const titleInput = new TextInputBuilder()
  .setCustomId('feedback_title')
  .setLabel('Title')
  .setStyle(TextInputStyle.Short)
  .setPlaceholder('Brief title for your feedback')
  .setRequired(true)
  .setMaxLength(100);

const descriptionInput = new TextInputBuilder()
  .setCustomId('feedback_description')
  .setLabel('Description')
  .setStyle(TextInputStyle.Paragraph)
  .setPlaceholder('Detailed description of your feedback')
  .setRequired(true)
  .setMaxLength(1000);

const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);

modal.addComponents(row1, row2);

// Show modal (can only be shown in response to interaction)
await interaction.showModal(modal);
```

### Modal with Multiple Inputs

```typescript
const modal = new ModalBuilder()
  .setCustomId('modal:profile')
  .setTitle('Edit Profile');

const nameInput = new TextInputBuilder()
  .setCustomId('profile_name')
  .setLabel('Display Name')
  .setStyle(TextInputStyle.Short)
  .setMaxLength(32)
  .setRequired(true);

const bioInput = new TextInputBuilder()
  .setCustomId('profile_bio')
  .setLabel('Bio')
  .setStyle(TextInputStyle.Paragraph)
  .setMaxLength(500)
  .setRequired(false);

const websiteInput = new TextInputBuilder()
  .setCustomId('profile_website')
  .setLabel('Website')
  .setStyle(TextInputStyle.Short)
  .setPlaceholder('https://example.com')
  .setRequired(false);

modal.addComponents(
  new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
  new ActionRowBuilder<TextInputBuilder>().addComponents(bioInput),
  new ActionRowBuilder<TextInputBuilder>().addComponents(websiteInput)
);
```

### Text Input Styles

```typescript
TextInputStyle.Short;     // Single-line input
TextInputStyle.Paragraph; // Multi-line input
```

### Handling Modal Submissions

```typescript
import { Events } from 'discord.js';
import type { Event } from '../types/index.js';

const event: Event = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isModalSubmit()) return;
    
    const [action] = interaction.customId.split(':');
    
    switch (action) {
      case 'feedback': {
        const title = interaction.fields.getTextInputValue('feedback_title');
        const description = interaction.fields.getTextInputValue('feedback_description');
        
        // Process feedback
        await interaction.reply({
          content: `Thank you for your feedback: "${title}"`,
          ephemeral: true,
        });
        break;
      }
      case 'profile': {
        const name = interaction.fields.getTextInputValue('profile_name');
        const bio = interaction.fields.getTextInputValue('profile_bio');
        const website = interaction.fields.getTextInputValue('profile_website');
        
        // Save profile data
        await interaction.reply({
          content: `Profile updated for ${name}!`,
          ephemeral: true,
        });
        break;
      }
    }
  },
};
```

## Advanced Patterns

### Dynamic Buttons from Data

```typescript
function createActionButtons(itemId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`edit:${itemId}`)
      .setLabel('Edit')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`delete:${itemId}`)
      .setLabel('Delete')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`view:${itemId}`)
      .setLabel('View')
      .setStyle(ButtonStyle.Secondary)
  );
}
```

### Disable Components After Use

```typescript
if (interaction.isButton()) {
  // Get the original message's components
  const row = ActionRowBuilder.from<ButtonBuilder>(
    interaction.message.components[0]
  );
  
  // Disable all buttons in the row
  row.components.forEach(button => button.setDisabled(true));
  
  // Update the message
  await interaction.update({
    content: 'Action completed!',
    components: [row],
  });
}
```

### Timeout and Cleanup

```typescript
// Create a collector for button interactions
const message = await interaction.reply({
  content: 'Click a button:',
  components: [row],
  fetchReply: true,
});

const collector = message.createMessageComponentCollector({
  filter: i => i.user.id === interaction.user.id,
  time: 60000, // 60 seconds
});

collector.on('collect', async i => {
  await i.reply(`You clicked ${i.customId}!`);
  collector.stop();
});

collector.on('end', async () => {
  // Disable components when collector ends
  const disabledRow = ActionRowBuilder.from<ButtonBuilder>(row);
  disabledRow.components.forEach(button => button.setDisabled(true));
  
  await interaction.editReply({
    components: [disabledRow],
  });
});
```
