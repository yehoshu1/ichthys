import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ChannelType,
} from 'discord.js';
import { Command } from '../types/Command';
import { eventService } from '../services/event-service';
import { pollService } from '../services/poll-service';
import { formatDiscordTimestamp } from '../utils/date-parser';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
    .setName('list')
    .setDescription('List upcoming events or active polls')
    .addStringOption(option =>
        option
            .setName('type')
            .setDescription('What to list')
            .setRequired(true)
            .addChoices(
                { name: 'Events', value: 'events' },
                { name: 'Polls', value: 'polls' }
            )
    )
    .addChannelOption(option =>
        option
            .setName('channel')
            .setDescription('Filter by channel')
            .addChannelTypes(ChannelType.GuildText)
    )
    .addIntegerOption(option =>
        option
            .setName('limit')
            .setDescription('Number of items to show (default: 10)')
            .setMinValue(1)
            .setMaxValue(25)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        if (!guild) {
            await interaction.editReply('This command can only be used in a server.');
            return;
        }

        const type = interaction.options.getString('type', true);
        const channelFilter = interaction.options.getChannel('channel');
        const limit = interaction.options.getInteger('limit') || 10;

        if (type === 'events') {
            await listEvents(interaction, guild.id, channelFilter?.id ?? null, limit);
        } else {
            await listPolls(interaction, guild.id, channelFilter?.id ?? null, limit);
        }

    } catch (error) {
        logger.error('Error listing items:', error);
        await interaction.editReply('An error occurred while listing items. Please try again.');
    }
}

async function listEvents(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    channelId: string | null,
    limit: number
) {
    const events = await eventService.getEventsByGuild(guildId, { upcoming: true, limit: 25 });

    if (events.length === 0) {
        await interaction.editReply('No upcoming events found.');
        return;
    }

    // Filter by channel if specified
    const filteredEvents = channelId 
        ? events.filter(e => e.channelId === channelId)
        : events;

    if (filteredEvents.length === 0) {
        await interaction.editReply('No upcoming events found in the specified channel.');
        return;
    }

    const limitedEvents = filteredEvents.slice(0, limit);

    const embed = new EmbedBuilder()
        .setTitle('📅 Upcoming Events')
        .setColor('#5865F2')
        .setDescription(`Showing ${limitedEvents.length} event${limitedEvents.length !== 1 ? 's' : ''}${channelId ? ' in <#' + channelId + '>' : ''}`);

    for (const evt of limitedEvents) {
        const rsvpCounts = await eventService.getRsvpCounts(evt.id);
        const value = [
            `📍 <#${evt.channelId}>`,
            `🕐 ${formatDiscordTimestamp(evt.startTime, 'F')}`,
            `👥 ${rsvpCounts.yes} going, ${rsvpCounts.maybe} maybe`,
        ];

        if (evt.locationChannelId) {
            value.push(`🎙️ Voice location: <#${evt.locationChannelId}>`);
        }

        if (evt.location) {
            value.push(`📍 ${evt.location}`);
        }

        if (evt.maxAttendees) {
            value.push(`🎫 ${evt.maxAttendees - rsvpCounts.yes} spots left`);
        }

        embed.addFields({
            name: buildFieldNameWithId(evt.title, evt.id),
            value: value.join('\n'),
            inline: false,
        });
    }

    await interaction.editReply({ embeds: [embed] });
}

async function listPolls(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    channelId: string | null,
    limit: number
) {
    const polls = await pollService.getPollsByGuild(guildId, { closed: false });

    if (polls.length === 0) {
        await interaction.editReply('No active polls found.');
        return;
    }

    // Filter by channel if specified
    const filteredPolls = channelId
        ? polls.filter(p => p.channelId === channelId)
        : polls;

    if (filteredPolls.length === 0) {
        await interaction.editReply('No active polls found in the specified channel.');
        return;
    }

    const limitedPolls = filteredPolls.slice(0, limit);

    const embed = new EmbedBuilder()
        .setTitle('📊 Active Polls')
        .setColor('#5865F2')
        .setDescription(`Showing ${limitedPolls.length} poll${limitedPolls.length !== 1 ? 's' : ''}${channelId ? ' in <#' + channelId + '>' : ''}`);

    for (const poll of limitedPolls) {
        const results = await pollService.getResults(poll.id);
        
        const value = [
            `📍 <#${poll.channelId}>`,
            `🗳️ ${results.totalVotes} vote${results.totalVotes !== 1 ? 's' : ''}`,
        ];

        if (poll.endTime) {
            value.push(`⏰ Ends ${formatDiscordTimestamp(poll.endTime, 'R')}`);
        }

        const typeLabels: Record<string, string> = {
            'STANDARD': '📊 Standard',
            'TIME': '🕐 Time-based',
            'ANONYMOUS': '🕵️ Anonymous',
        };
        value.push(`${typeLabels[poll.type] || '📊 Poll'}`);

        embed.addFields({
            name: buildFieldNameWithId(poll.question, poll.id),
            value: value.join('\n'),
            inline: false,
        });
    }

    await interaction.editReply({ embeds: [embed] });
}

function buildFieldNameWithId(label: string, id: string): string {
    const suffix = ` | ID: ${id}`;
    const maxFieldNameLength = 256;

    if (label.length + suffix.length <= maxFieldNameLength) {
        return `${label}${suffix}`;
    }

    const truncatedLabelMax = Math.max(1, maxFieldNameLength - suffix.length - 3);
    return `${label.slice(0, truncatedLabelMax).trimEnd()}...${suffix}`;
}

export default { data, execute } as Command;
