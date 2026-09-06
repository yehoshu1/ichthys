import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    ChannelType,
    EmbedBuilder,
    RoleSelectMenuBuilder
} from 'discord.js';
import type { Guild } from 'discord.js';
import type { GuildConfig } from '../../shared/database/schema';

export type SetupPage = 'toggles' | 'targets';

export function buildSetupPanel(guild: Guild, config: GuildConfig, page: SetupPage) {
    const embed = new EmbedBuilder()
        .setTitle('⚙️ Ixoye Setup')
        .setColor('#2CB7C9')
        .setDescription('Use the controls below to configure the core modules. Changes apply immediately.')
        .addFields(
            { name: 'Welcome', value: config.welcomeEnabled ? 'Enabled' : 'Disabled', inline: true },
            { name: 'Verification', value: config.verificationEnabled ? 'Enabled' : 'Disabled', inline: true },
            { name: 'Boosts', value: config.boostEnabled ? 'Enabled' : 'Disabled', inline: true },
            { name: 'Leveling', value: config.levelingEnabled ? 'Enabled' : 'Disabled', inline: true },
            { name: 'Level-Up Notifs', value: config.levelUpNotifEnabled ? 'Enabled' : 'Disabled', inline: true }
        )
        .setFooter({ text: `Server: ${guild.name}` });

    if (page === 'toggles') {
        const toggleRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('setup:toggle:welcome')
                    .setLabel(`Welcome: ${config.welcomeEnabled ? 'On' : 'Off'}`)
                    .setStyle(config.welcomeEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('setup:toggle:verification')
                    .setLabel(`Verification: ${config.verificationEnabled ? 'On' : 'Off'}`)
                    .setStyle(config.verificationEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('setup:toggle:boost')
                    .setLabel(`Boosts: ${config.boostEnabled ? 'On' : 'Off'}`)
                    .setStyle(config.boostEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('setup:toggle:leveling')
                    .setLabel(`Leveling: ${config.levelingEnabled ? 'On' : 'Off'}`)
                    .setStyle(config.levelingEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('setup:toggle:levelup')
                    .setLabel(`Level-Up: ${config.levelUpNotifEnabled ? 'On' : 'Off'}`)
                    .setStyle(config.levelUpNotifEnabled ? ButtonStyle.Success : ButtonStyle.Secondary)
            );

        const navRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('setup:page:targets')
                    .setLabel('Configure Roles/Channels')
                    .setStyle(ButtonStyle.Primary)
            );

        return { embeds: [embed], components: [toggleRow, navRow] };
    }

    const verifiedRoleRow = new ActionRowBuilder<RoleSelectMenuBuilder>()
        .addComponents(
            new RoleSelectMenuBuilder()
                .setCustomId('setup:role:verified')
                .setPlaceholder('Select verified role')
                .setMinValues(1)
                .setMaxValues(1)
        );

    const unverifiedRoleRow = new ActionRowBuilder<RoleSelectMenuBuilder>()
        .addComponents(
            new RoleSelectMenuBuilder()
                .setCustomId('setup:role:unverified')
                .setPlaceholder('Select unverified role (optional)')
                .setMinValues(1)
                .setMaxValues(1)
        );

    const boostRoleRow = new ActionRowBuilder<RoleSelectMenuBuilder>()
        .addComponents(
            new RoleSelectMenuBuilder()
                .setCustomId('setup:role:boost')
                .setPlaceholder('Select boost reward role')
                .setMinValues(1)
                .setMaxValues(1)
        );

    const levelUpChannelRow = new ActionRowBuilder<ChannelSelectMenuBuilder>()
        .addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('setup:channel:levelup')
                .setPlaceholder('Select level-up notification channel')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setMinValues(1)
                .setMaxValues(1)
        );

    const navRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('setup:page:toggles')
                .setLabel('Back to Toggles')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('setup:clear:optional')
                .setLabel('Clear Optional Fields')
                .setStyle(ButtonStyle.Danger)
        );

    return {
        embeds: [embed],
        components: [verifiedRoleRow, unverifiedRoleRow, boostRoleRow, levelUpChannelRow, navRow],
    };
}
