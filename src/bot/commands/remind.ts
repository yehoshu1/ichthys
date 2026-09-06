import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { Command } from '../types/Command';
import { eventService } from '../services/event-service';
import { formatDiscordTimestamp } from '../utils/date-parser';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set a personal reminder for an event')
    .addStringOption(option =>
        option
            .setName('event_id')
            .setDescription('ID of the event (use /list to find IDs)')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('when')
            .setDescription('When to remind you (e.g., "10 minutes before", "1 hour before", "1 day before")')
            .setRequired(true)
    );

// Common reminder presets
const reminderPresets = [
    { label: 'on event start', minutes: 0 },
    { label: '10 minutes before', minutes: 10 },
    { label: '30 minutes before', minutes: 30 },
    { label: '1 hour before', minutes: 60 },
    { label: '2 hours before', minutes: 120 },
    { label: '1 day before', minutes: 1440 },
];

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        if (!guild) {
            await interaction.editReply('This command can only be used in a server.');
            return;
        }

        const eventId = interaction.options.getString('event_id', true);
        const whenInput = interaction.options.getString('when', true);

        // Get the event
        const evt = await eventService.getEventById(eventId);

        if (!evt) {
            await interaction.editReply('Event not found. Use `/list type:events` to see available events.');
            return;
        }

        if (evt.guildId !== guild.id) {
            await interaction.editReply('This event is not in this server.');
            return;
        }

        // Parse the reminder time
        const minutesBefore = parseReminderTime(whenInput);

        if (minutesBefore === null || minutesBefore < 0) {
            const presetsList = reminderPresets.map(p => `• "${p.label}"`).join('\n');
            await interaction.editReply(
                `Invalid reminder time. Please use a format like:\n${presetsList}\n\nOr specify in minutes (e.g., "30 minutes before")`
            );
            return;
        }

        // Check if the reminder time is in the past
        const reminderTime = new Date(evt.startTime.getTime() - minutesBefore * 60000);
        if (reminderTime < new Date()) {
            await interaction.editReply('That reminder time has already passed. The event is too soon.');
            return;
        }

        // Set the reminder
        const reminderResult = await eventService.upsertReminder(eventId, interaction.user.id, minutesBefore);
        if (reminderResult.status === 'unchanged') {
            await interaction.editReply('You already have a reminder set for that time.');
            return;
        }

        const reminderTitle = reminderResult.status === 'updated' ? '⏰ Reminder Updated' : '⏰ Reminder Set';

        // Build confirmation embed
        const embed = new EmbedBuilder()
            .setTitle(reminderTitle)
            .setColor('#57F287')
            .setDescription(minutesBefore === 0
                ? `You will be reminded when **${evt.title}** starts.`
                : `You will be reminded about **${evt.title}** ${formatDiscordTimestamp(reminderTime, 'R')}`
            )
            .addFields(
                { name: 'Event', value: evt.title, inline: true },
                { name: 'Starts', value: formatDiscordTimestamp(evt.startTime, 'F'), inline: true },
                {
                    name: 'Reminder',
                    value: minutesBefore === 0 ? 'On event start' : formatDiscordTimestamp(reminderTime, 'R'),
                    inline: true,
                }
            );

        await interaction.editReply({ embeds: [embed] });

        logger.info(`Reminder set for user ${interaction.user.id} for event ${eventId} (${minutesBefore} minutes before)`);

    } catch (error) {
        logger.error('Error setting reminder:', error);
        await interaction.editReply('An error occurred while setting the reminder. Please try again.');
    }
}

function parseReminderTime(input: string): number | null {
    const normalized = input.toLowerCase().trim();

    // Check presets first
    for (const preset of reminderPresets) {
        if (normalized.includes(preset.label.toLowerCase()) ||
            normalized === 'event start' ||
            normalized === 'on start' ||
            normalized === `${preset.minutes}m` ||
            normalized === `${preset.minutes} minutes` ||
            normalized === `${preset.minutes} minute`) {
            return preset.minutes;
        }
    }

    // Parse various formats
    const patterns = [
        { regex: /^(\d+)\s*minutes?\s*(before)?$/i, fn: (m: number) => m },
        { regex: /^(\d+)\s*mins?\s*(before)?$/i, fn: (m: number) => m },
        { regex: /^(\d+)\s*h(?:ours?)?\s*(before)?$/i, fn: (h: number) => h * 60 },
        { regex: /^(\d+)\s*d(?:ays?)?\s*(before)?$/i, fn: (d: number) => d * 1440 },
        { regex: /^(\d+)\s*w(?:eeks?)?\s*(before)?$/i, fn: (w: number) => w * 10080 },
        { regex: /^(\d+):(\d+)\s*(before)?$/i, fn: (h: number, m: number) => h * 60 + m },
    ];

    for (const pattern of patterns) {
        const match = normalized.match(pattern.regex);
        if (match) {
            const values = match.slice(1).map(Number);
            return pattern.fn(values[0], values[1] || 0);
        }
    }

    return null;
}

export default { data, execute } as Command;
