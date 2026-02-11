import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    GuildMember,
    TextChannel,
} from 'discord.js';
import { Command } from '../types/Command';
import { eventService } from '../services/event-service';
import { parseNaturalLanguageDate, formatDiscordTimestamp } from '../utils/date-parser';
import logger from '../utils/logger';

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
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        if (!guild) {
            await interaction.editReply('This command can only be used in a server.');
            return;
        }

        const member = interaction.member as GuildMember;
        const channelOption = interaction.options.getChannel('channel');
        const channel = channelOption || interaction.channel;
        
        if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
            await interaction.editReply('Please specify a valid text channel.');
            return;
        }

        // Check permissions - only check if we're posting to a different channel
        if (channelOption && !member.permissionsIn(channel as TextChannel).has(PermissionFlagsBits.SendMessages)) {
            await interaction.editReply('You do not have permission to send messages in that channel.');
            return;
        }

        // Parse date/time
        const dateTimeInput = interaction.options.getString('datetime', true);
        const startTime = parseNaturalLanguageDate(dateTimeInput);

        if (!startTime || startTime < new Date()) {
            await interaction.editReply('Invalid date/time. Please use a future date/time (e.g., "tomorrow 6pm", "in 3 hours").');
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
            const parsedRepeatUntil = parseNaturalLanguageDate(repeatUntilInput);
            repeatUntil = parsedRepeatUntil ?? undefined;
            if (!repeatUntil || repeatUntil <= startTime) {
                await interaction.editReply('Invalid repeat until date. It must be after the event start time.');
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
        };

        const createdEvent = await eventService.createEvent(eventData);

        // Build the event embed
        const embed = buildEventEmbed(createdEvent);

        // Create RSVP buttons
        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`event:rsvp:${createdEvent.id}:YES`)
                .setLabel('✅ Going')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`event:rsvp:${createdEvent.id}:MAYBE`)
                .setLabel('🤔 Maybe')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`event:rsvp:${createdEvent.id}:NO`)
                .setLabel('❌ Not Going')
                .setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`event:reminder:${createdEvent.id}`)
                .setLabel('⏰ Set Reminder')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`event:details:${createdEvent.id}`)
                .setLabel('📋 Details')
                .setStyle(ButtonStyle.Secondary)
        );

        // Build mention string
        const mentionRole = interaction.options.getRole('mention_on_create');
        const content = mentionRole ? `<@&${mentionRole.id}>` : undefined;

        // Send the event message
        const message = await (channel as TextChannel).send({
            content,
            embeds: [embed],
            components: [row1, row2],
        });

        // Update event with message ID
        await eventService.setEventMessageId(createdEvent.id, message.id);

        // Handle repeating events
        if (repeatInput !== 'NONE' && repeatUntil) {
            const repeatingEvents = await eventService.createRepeatingEvents(createdEvent);
            
            await interaction.editReply({
                content: `✅ Event created successfully! ${repeatingEvents.length > 0 ? `+ ${repeatingEvents.length} repeating instances` : ''}`,
            });
        } else {
            await interaction.editReply('✅ Event created successfully!');
        }

        logger.info(`Event created: ${createdEvent.id} by ${interaction.user.tag} in ${guild.name}`);

    } catch (error) {
        logger.error('Error creating event:', error);
        await interaction.editReply('An error occurred while creating the event. Please try again.');
    }
}

function buildEventEmbed(event: any): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setTitle('📅 ' + event.title)
        .setColor('#5865F2')
        .setTimestamp(event.createdAt);

    if (event.description) {
        embed.setDescription(event.description);
    }

    // Add time fields
    embed.addFields(
        { 
            name: '🕐 Starts', 
            value: `${formatDiscordTimestamp(event.startTime, 'F')}\n${formatDiscordTimestamp(event.startTime, 'R')}`,
            inline: false 
        }
    );

    if (event.endTime) {
        embed.addFields({
            name: '🕐 Ends',
            value: formatDiscordTimestamp(event.endTime, 'F'),
            inline: false,
        });
    }

    if (event.location) {
        embed.addFields({ name: '📍 Location', value: event.location, inline: true });
    }

    if (event.maxAttendees) {
        embed.addFields({ 
            name: '👥 Spots', 
            value: `${event.maxAttendees} max${event.enableWaitlist ? ' (with waitlist)' : ''}`, 
            inline: true 
        });
    }

    if (event.requiredRoleIds?.length) {
        embed.addFields({ 
            name: '🔒 Required Role', 
            value: `<@&${event.requiredRoleIds[0]}>`, 
            inline: true 
        });
    }

    if (event.attendeeRoleId) {
        embed.addFields({
            name: '🎁 Attendee Role',
            value: `<@&${event.attendeeRoleId}>`,
            inline: true,
        });
    }

    if (event.repeatFrequency && event.repeatFrequency !== 'NONE') {
        embed.addFields({
            name: '🔄 Repeats',
            value: event.repeatFrequency.charAt(0) + event.repeatFrequency.slice(1).toLowerCase(),
            inline: true,
        });
    }

    // RSVP counts will be updated dynamically
    embed.addFields({
        name: 'Attendees',
        value: '✅ 0 going | 🤔 0 maybe | ❌ 0 not going',
        inline: false,
    });

    if (event.imageUrl) {
        embed.setImage(event.imageUrl);
    }

    return embed;
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

export default { data, execute } as Command;
