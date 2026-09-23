import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ChannelType,
} from 'discord.js';
import { Command } from '../types/Command';
import { eventService } from '../services/event-service';
import { isSupportedPostChannel, getEventPollSettingsForGuild } from '../services/event-poll-settings-service';
import { getCommandPolicyContext } from '../services/command-policy-service';
import { parseNaturalLanguageDate } from '../utils/date-parser';
import logger from '../utils/logger';
import { eventDiscordService } from '../services/event-discord-service';

export const data = new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create a new event')
    .addStringOption(option =>
        option
            .setName('title')
            .setDescription('Title of the event')
            .setRequired(true)
            .setMaxLength(100)
    )
    .addStringOption(option =>
        option
            .setName('datetime')
            .setDescription('When the event starts (e.g., "tomorrow 6pm", "in 3 hours", "2026-02-15 18:00")')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('description')
            .setDescription('Description of the event')
            .setMaxLength(2000)
    )
    .addStringOption(option =>
        option
            .setName('duration')
            .setDescription('Duration (e.g., "1h30m", "2 hours", "90m")')
    )
    .addStringOption(option =>
        option
            .setName('location')
            .setDescription('Location of the event')
            .setMaxLength(200)
    )
    .addChannelOption(option =>
        option
            .setName('location_voice_channel')
            .setDescription('Voice/Stage channel to use as event location')
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
    )
    .addStringOption(option =>
        option
            .setName('image')
            .setDescription('URL of an image to display')
    )
    .addChannelOption(option =>
        option
            .setName('channel')
            .setDescription('Channel to post the event in')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addRoleOption(option =>
        option
            .setName('mention_on_create')
            .setDescription('Role to mention when the event is created')
    )
    .addRoleOption(option =>
        option
            .setName('mention_on_start')
            .setDescription('Role to mention when the event starts')
    )
    .addIntegerOption(option =>
        option
            .setName('max_attendees')
            .setDescription('Maximum number of attendees')
            .setMinValue(1)
            .setMaxValue(1000)
    )
    .addBooleanOption(option =>
        option
            .setName('enable_waitlist')
            .setDescription('Enable waitlist when event is full')
    )
    .addRoleOption(option =>
        option
            .setName('required_role')
            .setDescription('Required role to attend this event')
    )
    .addRoleOption(option =>
        option
            .setName('blocked_role')
            .setDescription('Role that cannot attend this event')
    )
    .addRoleOption(option =>
        option
            .setName('attendee_role')
            .setDescription('Role to assign to attendees')
    )
    .addStringOption(option =>
        option
            .setName('repeat')
            .setDescription('Repeat frequency')
            .addChoices(
                { name: 'None', value: 'NONE' },
                { name: 'Daily', value: 'DAILY' },
                { name: 'Weekly', value: 'WEEKLY' },
                { name: 'Bi-weekly', value: 'BIWEEKLY' },
                { name: 'Monthly', value: 'MONTHLY' },
                { name: 'Yearly', value: 'YEARLY' }
            )
    )
    .addStringOption(option =>
        option
            .setName('repeat_until')
            .setDescription('When to stop repeating (e.g., "3 months", "2026-12-31")')
    )
    .addBooleanOption(option =>
        option
            .setName('mirror_to_discord')
            .setDescription('Mirror this event to Discord native events (defaults to server setting)')
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        if (!(await ensureCreateAcknowledged(interaction))) {
            return;
        }

        const guild = interaction.guild;
        if (!guild) {
            await sendCreateResponse(interaction, 'This command can only be used in a server.');
            return;
        }

        const policyContext = getCommandPolicyContext(interaction);
        const channel = policyContext?.targetChannel ?? interaction.channel;

        if (!isSupportedPostChannel(channel)) {
            await sendCreateResponse(interaction, 'Please specify a valid text channel.');
            return;
        }

        const settings = await getEventPollSettingsForGuild(guild.id);
        const timezone = settings?.serverTimezone || 'UTC';

        // Parse date/time
        const dateTimeInput = interaction.options.getString('datetime', true);
        const startTime = parseNaturalLanguageDate(dateTimeInput, timezone);

        if (!startTime || startTime < new Date()) {
            await sendCreateResponse(interaction, 'Invalid date/time. Please use a future date/time (e.g., "tomorrow 6pm", "in 3 hours").');
            return;
        }

        // Parse duration
        const durationInput = interaction.options.getString('duration');
        let durationMinutes: number | undefined;
        let endTime: Date | null = null;

        if (durationInput) {
            durationMinutes = parseDuration(durationInput);
            if (durationMinutes) {
                endTime = new Date(startTime.getTime() + durationMinutes * 60000);
            }
        }

        // Parse repeat until
        const repeatInput = interaction.options.getString('repeat') || 'NONE';
        const repeatUntilInput = interaction.options.getString('repeat_until');
        let repeatUntil: Date | undefined = undefined;

        if (repeatInput !== 'NONE' && repeatUntilInput) {
            const parsedRepeatUntil = parseNaturalLanguageDate(repeatUntilInput, timezone);
            repeatUntil = parsedRepeatUntil ?? undefined;
            if (!repeatUntil || repeatUntil <= startTime) {
                await sendCreateResponse(interaction, 'Invalid repeat until date. It must be after the event start time.');
                return;
            }
        }

        // Create the event
        const eventData = {
            guildId: guild.id,
            creatorId: interaction.user.id,
            channelId: channel.id,
            title: interaction.options.getString('title', true),
            description: interaction.options.getString('description') || undefined,
            startTime,
            endTime,
            durationMinutes,
            location: interaction.options.getString('location') || undefined,
            locationChannelId: interaction.options.getChannel('location_voice_channel')?.id || undefined,
            imageUrl: interaction.options.getString('image') || undefined,
            maxAttendees: interaction.options.getInteger('max_attendees') || undefined,
            enableWaitlist: interaction.options.getBoolean('enable_waitlist') || false,
            mentionRoleIds: [
                interaction.options.getRole('mention_on_create')?.id,
                interaction.options.getRole('mention_on_start')?.id,
            ].filter(Boolean) as string[] | undefined,
            mentionOnCreate: !!interaction.options.getRole('mention_on_create'),
            mentionOnStart: !!interaction.options.getRole('mention_on_start'),
            requiredRoleIds: interaction.options.getRole('required_role')?.id 
                ? [interaction.options.getRole('required_role')!.id] 
                : undefined,
            blockedRoleIds: interaction.options.getRole('blocked_role')?.id 
                ? [interaction.options.getRole('blocked_role')!.id] 
                : undefined,
            attendeeRoleId: interaction.options.getRole('attendee_role')?.id || undefined,
            repeatFrequency: repeatInput as any,
            repeatUntil,
            mirrorToDiscord: interaction.options.getBoolean('mirror_to_discord') ?? undefined,
        };

        const createdEvent = await eventService.createEvent(eventData, guild);

        // Send the event message using the centralized discord service
        let postedEventMessage = false;
        try {
            const message = await eventDiscordService.createEventMessage(createdEvent, guild);
            postedEventMessage = !!message;
        } catch (sendError) {
            logger.error('Failed to send created event message:', sendError);
        }

        // Handle repeating events
        const mirrorText = createdEvent.mirrorToDiscord 
            ? (createdEvent.discordScheduledEventId ? '📅 Also created as Discord Scheduled Event' : '📅 (Discord Event creation failed)')
            : '';
        const messagePostWarning = postedEventMessage
            ? ''
            : ' ⚠️ Event was saved, but I could not post its embed in the target channel.';
        
        if (repeatInput !== 'NONE' && repeatUntil) {
            const repeatingEvents = await eventService.createRepeatingEvents(createdEvent);
            
            await sendCreateResponse(
                interaction,
                `✅ Event created successfully! ${repeatingEvents.length > 0 ? `+ ${repeatingEvents.length} repeating instances` : ''} ${mirrorText}${messagePostWarning}`
            );
        } else {
            await sendCreateResponse(interaction, `✅ Event created successfully! ${mirrorText}${messagePostWarning}`);
        }

        logger.info(`Event created: ${createdEvent.id} by ${interaction.user.tag} in ${guild.name}`);

    } catch (error) {
        logger.error('Error creating event:', error);
        await sendCreateResponse(interaction, 'An error occurred while creating the event. Please try again.');
    }
}

async function ensureCreateAcknowledged(interaction: ChatInputCommandInteraction): Promise<boolean> {
    if (interaction.deferred || interaction.replied) {
        return true;
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            await interaction.deferReply({ ephemeral: true });
            return true;
        } catch (error) {
            const retryable = isRetryableNetworkError(error);
            logger.warn(`Failed to defer /create interaction (attempt ${attempt}/3):`, error);
            if (!retryable || attempt === 3) {
                break;
            }
            await delay(250 * attempt);
        }
    }

    return sendCreateResponse(
        interaction,
        'I could not acknowledge this interaction in time. Please run `/create` again.'
    );
}

async function sendCreateResponse(interaction: ChatInputCommandInteraction, content: string): Promise<boolean> {
    if (interaction.deferred || interaction.replied) {
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                await interaction.editReply({ content });
                return true;
            } catch (editError) {
                const retryable = isRetryableNetworkError(editError);
                logger.warn(`Failed to edit /create interaction reply (attempt ${attempt}/2):`, editError);
                if (!retryable || attempt === 2) {
                    break;
                }
                await delay(250 * attempt);
            }
        }
    }

    try {
        await interaction.reply({ content, ephemeral: true });
        return true;
    } catch (replyError) {
        logger.warn('Failed to send /create interaction reply, attempting follow-up:', replyError);
    }

    try {
        await interaction.followUp({ content, ephemeral: true });
        return true;
    } catch (followUpError) {
        logger.error('Failed to send /create interaction response:', followUpError);
        return false;
    }
}

function isRetryableNetworkError(error: unknown): boolean {
    const message = String((error as any)?.message ?? error ?? '');
    return [
        'EAI_AGAIN',
        'ETIMEDOUT',
        'ECONNRESET',
        'ECONNREFUSED',
        'ENOTFOUND',
    ].some(code => message.includes(code));
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}



function parseDuration(input: string): number | undefined {
    const patterns = [
        { regex: /^(\d+)h(\d+)m?$/i, fn: (h: number, m: number) => h * 60 + m },
        { regex: /^(\d+)\s*hours?$/i, fn: (h: number) => h * 60 },
        { regex: /^(\d+)\s*h$/i, fn: (h: number) => h * 60 },
        { regex: /^(\d+)\s*minutes?$/i, fn: (m: number) => m },
        { regex: /^(\d+)\s*m$/i, fn: (m: number) => m },
    ];

    for (const pattern of patterns) {
        const match = input.match(pattern.regex);
        if (match) {
            const values = match.slice(1).map(Number);
            return pattern.fn(values[0], values[1] || 0);
        }
    }

    return undefined;
}

export default {
    data,
    execute,
    moduleId: 'events',
    policy: {
        creatorPolicy: 'events',
        postChannelPolicy: 'events',
        channelOptionName: 'channel',
        requireMemberSendPermissionInTargetChannel: true,
        requireBotSendPermissionInTargetChannel: true,
    },
} as Command;
