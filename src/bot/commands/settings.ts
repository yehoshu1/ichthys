import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType,
} from 'discord.js';
import { Command } from '../types/Command';
import { db } from '@shared/database/client';
import { eventPollSettings } from '@shared/database/schema';
import { eq } from 'drizzle-orm';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Configure event and poll settings for this server')
    .addSubcommand(subcommand =>
        subcommand
            .setName('view')
            .setDescription('View current settings')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('channel')
            .setDescription('Set default channels')
            .addStringOption(option =>
                option
                    .setName('type')
                    .setDescription('Which default channel to set')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Events', value: 'events' },
                        { name: 'Polls', value: 'polls' },
                        { name: 'Both', value: 'both' }
                    )
            )
            .addChannelOption(option =>
                option
                    .setName('channel')
                    .setDescription('The default channel')
                    .setRequired(true)
                    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('timezone')
            .setDescription('Set the server timezone')
            .addStringOption(option =>
                option
                    .setName('timezone')
                    .setDescription('Timezone (e.g., UTC, America/New_York, Europe/London)')
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('mentions')
            .setDescription('Configure default mention behavior')
            .addBooleanOption(option =>
                option
                    .setName('on_create')
                    .setDescription('Mention roles when events are created')
            )
            .addBooleanOption(option =>
                option
                    .setName('on_start')
                    .setDescription('Mention roles when events start')
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('permissions')
            .setDescription('Configure who can create events and polls')
            .addRoleOption(option =>
                option
                    .setName('event_creators')
                    .setDescription('Role allowed to create events')
            )
            .addRoleOption(option =>
                option
                    .setName('poll_creators')
                    .setDescription('Role allowed to create polls')
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('ai')
            .setDescription('Configure AI settings')
            .addBooleanOption(option =>
                option
                    .setName('enabled')
                    .setDescription('Enable AI features')
            )
            .addIntegerOption(option =>
                option
                    .setName('rate_limit')
                    .setDescription('Max AI commands per hour per user')
                    .setMinValue(1)
                    .setMaxValue(100)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('discord')
            .setDescription('Configure Discord integration settings')
            .addBooleanOption(option =>
                option
                    .setName('mirror_to_events')
                    .setDescription('Mirror new events to Discord Scheduled Events by default')
            )
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        if (!guild) {
            await interaction.editReply('This command can only be used in a server.');
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        // Get or create settings
        let settings = await getSettings(guild.id);

        switch (subcommand) {
            case 'view':
                await viewSettings(interaction, settings);
                break;
            case 'channel':
                await setChannel(interaction, settings);
                break;
            case 'timezone':
                await setTimezone(interaction, settings);
                break;
            case 'mentions':
                await setMentions(interaction, settings);
                break;
            case 'permissions':
                await setPermissions(interaction, settings);
                break;
            case 'ai':
                await setAiSettings(interaction, settings);
                break;
            case 'discord':
                await setDiscordSettings(interaction, settings);
                break;
        }

    } catch (error) {
        logger.error('Error in settings command:', error);
        await interaction.editReply('An error occurred. Please try again.');
    }
}

async function getSettings(guildId: string) {
    const [existing] = await db
        .select()
        .from(eventPollSettings)
        .where(eq(eventPollSettings.guildId, guildId));

    if (existing) {
        return existing;
    }

    // Create default settings
    const [created] = await db
        .insert(eventPollSettings)
        .values({ guildId })
        .returning();

    return created;
}

async function viewSettings(interaction: ChatInputCommandInteraction, settings: any) {
    const embed = new EmbedBuilder()
        .setTitle('⚙️ Event & Poll Settings')
        .setColor('#5865F2')
        .addFields(
            {
                name: '📍 Default Channels',
                value: [
                    `Events: ${settings.defaultEventChannelId ? `<#${settings.defaultEventChannelId}>` : 'Not set'}`,
                    `Polls: ${settings.defaultPollChannelId ? `<#${settings.defaultPollChannelId}>` : 'Not set'}`,
                ].join('\n'),
                inline: false,
            },
            {
                name: '🌍 Timezone',
                value: settings.serverTimezone || 'UTC',
                inline: true,
            },
            {
                name: '🔔 Mentions',
                value: [
                    `On Create: ${settings.defaultMentionOnCreate ? '✅' : '❌'}`,
                    `On Start: ${settings.defaultMentionOnStart ? '✅' : '❌'}`,
                ].join('\n'),
                inline: true,
            },
            {
                name: '🔒 Permissions',
                value: [
                    `Event Creators: ${settings.allowedEventCreators?.length ? `${settings.allowedEventCreators.length} role(s)` : 'All'}`,
                    `Poll Creators: ${settings.allowedPollCreators?.length ? `${settings.allowedPollCreators.length} role(s)` : 'All'}`,
                ].join('\n'),
                inline: true,
            },
            {
                name: '🤖 AI Settings',
                value: [
                    `Enabled: ${settings.aiEnabled ? '✅' : '❌'}`,
                    `Rate Limit: ${settings.aiRateLimitPerHour}/hour`,
                ].join('\n'),
                inline: true,
            },
            {
                name: '📅 Discord Integration',
                value: [
                    `Mirror to Discord Events: ${settings.mirrorToDiscordEvents ?? true ? '✅' : '❌'}`,
                ].join('\n'),
                inline: true,
            }
        );

    await interaction.editReply({ embeds: [embed] });
}

async function setChannel(interaction: ChatInputCommandInteraction, settings: any) {
    const type = interaction.options.getString('type', true);
    const channel = interaction.options.getChannel('channel', true);

    const updates: any = {};

    if (type === 'events' || type === 'both') {
        updates.defaultEventChannelId = channel.id;
    }
    if (type === 'polls' || type === 'both') {
        updates.defaultPollChannelId = channel.id;
    }

    await db
        .update(eventPollSettings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(eventPollSettings.id, settings.id));

    await interaction.editReply(`✅ Default channel for ${type === 'both' ? 'events and polls' : type} set to <#${channel.id}>`);
}

async function setTimezone(interaction: ChatInputCommandInteraction, settings: any) {
    const timezone = interaction.options.getString('timezone', true);

    // Basic timezone validation
    try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
        await interaction.editReply('Invalid timezone. Please use a valid IANA timezone like "UTC", "America/New_York", or "Europe/London".');
        return;
    }

    await db
        .update(eventPollSettings)
        .set({ serverTimezone: timezone, updatedAt: new Date() })
        .where(eq(eventPollSettings.id, settings.id));

    await interaction.editReply(`✅ Server timezone set to **${timezone}**`);
}

async function setMentions(interaction: ChatInputCommandInteraction, settings: any) {
    const onCreate = interaction.options.getBoolean('on_create');
    const onStart = interaction.options.getBoolean('on_start');

    const updates: any = {};
    if (onCreate !== null) updates.defaultMentionOnCreate = onCreate;
    if (onStart !== null) updates.defaultMentionOnStart = onStart;

    if (Object.keys(updates).length === 0) {
        await interaction.editReply('Please specify at least one mention setting.');
        return;
    }

    await db
        .update(eventPollSettings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(eventPollSettings.id, settings.id));

    const changes = [];
    if (onCreate !== null) changes.push(`mention on create: ${onCreate ? 'enabled' : 'disabled'}`);
    if (onStart !== null) changes.push(`mention on start: ${onStart ? 'enabled' : 'disabled'}`);

    await interaction.editReply(`✅ Mention settings updated: ${changes.join(', ')}`);
}

async function setPermissions(interaction: ChatInputCommandInteraction, settings: any) {
    const eventCreators = interaction.options.getRole('event_creators');
    const pollCreators = interaction.options.getRole('poll_creators');

    const updates: any = {};

    if (eventCreators) {
        const currentRoles = settings.allowedEventCreators || [];
        if (!currentRoles.includes(eventCreators.id)) {
            updates.allowedEventCreators = [...currentRoles, eventCreators.id];
        }
    }

    if (pollCreators) {
        const currentRoles = settings.allowedPollCreators || [];
        if (!currentRoles.includes(pollCreators.id)) {
            updates.allowedPollCreators = [...currentRoles, pollCreators.id];
        }
    }

    if (Object.keys(updates).length === 0) {
        await interaction.editReply('Please specify at least one role to add.');
        return;
    }

    await db
        .update(eventPollSettings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(eventPollSettings.id, settings.id));

    const changes = [];
    if (eventCreators) changes.push(`event creators can now include <@&${eventCreators.id}>`);
    if (pollCreators) changes.push(`poll creators can now include <@&${pollCreators.id}>`);

    await interaction.editReply(`✅ Permissions updated: ${changes.join(', ')}`);
}

async function setAiSettings(interaction: ChatInputCommandInteraction, settings: any) {
    const enabled = interaction.options.getBoolean('enabled');
    const rateLimit = interaction.options.getInteger('rate_limit');

    const updates: any = {};
    if (enabled !== null) updates.aiEnabled = enabled;
    if (rateLimit !== null) updates.aiRateLimitPerHour = rateLimit;

    if (Object.keys(updates).length === 0) {
        await interaction.editReply('Please specify at least one AI setting.');
        return;
    }

    await db
        .update(eventPollSettings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(eventPollSettings.id, settings.id));

    const changes = [];
    if (enabled !== null) changes.push(`AI ${enabled ? 'enabled' : 'disabled'}`);
    if (rateLimit !== null) changes.push(`rate limit set to ${rateLimit}/hour`);

    await interaction.editReply(`✅ AI settings updated: ${changes.join(', ')}`);
}

async function setDiscordSettings(interaction: ChatInputCommandInteraction, settings: any) {
    const mirrorToEvents = interaction.options.getBoolean('mirror_to_events');

    const updates: any = {};
    if (mirrorToEvents !== null) updates.mirrorToDiscordEvents = mirrorToEvents;

    if (Object.keys(updates).length === 0) {
        await interaction.editReply('Please specify at least one Discord setting.');
        return;
    }

    await db
        .update(eventPollSettings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(eventPollSettings.id, settings.id));

    const changes = [];
    if (mirrorToEvents !== null) changes.push(`Mirror to Discord Events ${mirrorToEvents ? 'enabled' : 'disabled'}`);

    await interaction.editReply(`✅ Discord settings updated: ${changes.join(', ')}`);
}

export default {
    data,
    execute,
    moduleId: 'events',
    policy: {
        requiredMemberPermissions: [PermissionFlagsBits.ManageGuild],
    },
} as Command;
