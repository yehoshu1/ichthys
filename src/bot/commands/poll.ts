import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} from 'discord.js';
import { Command } from '../types/Command';
import { pollService } from '../services/poll-service';
import { isSupportedPostChannel } from '../services/event-poll-settings-service';
import { getCommandPolicyContext } from '../services/command-policy-service';
import { parseNaturalLanguageDate, formatDiscordTimestamp } from '../utils/date-parser';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a poll')
    .addStringOption(option =>
        option
            .setName('question')
            .setDescription('The poll question')
            .setRequired(true)
            .setMaxLength(256)
    )
    .addStringOption(option =>
        option
            .setName('options')
            .setDescription('Poll options separated by commas (e.g., "Option 1, Option 2, Option 3")')
            .setRequired(true)
            .setMaxLength(1000)
    )
    .addStringOption(option =>
        option
            .setName('description')
            .setDescription('Additional description for the poll')
            .setMaxLength(1000)
    )
    .addChannelOption(option =>
        option
            .setName('channel')
            .setDescription('Channel to post the poll in')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addStringOption(option =>
        option
            .setName('type')
            .setDescription('Poll type')
            .addChoices(
                { name: 'Standard', value: 'STANDARD' },
                { name: 'Time-based (for scheduling)', value: 'TIME' },
                { name: 'Anonymous', value: 'ANONYMOUS' }
            )
    )
    .addBooleanOption(option =>
        option
            .setName('allow_multiple')
            .setDescription('Allow users to vote for multiple options')
    )
    .addIntegerOption(option =>
        option
            .setName('max_votes')
            .setDescription('Maximum number of options a user can vote for')
            .setMinValue(1)
            .setMaxValue(25)
    )
    .addBooleanOption(option =>
        option
            .setName('allow_custom_options')
            .setDescription('Allow users to add their own options')
    )
    .addStringOption(option =>
        option
            .setName('end_time')
            .setDescription('When the poll ends (e.g., "in 2 hours", "tomorrow 5pm")')
    )
    .addRoleOption(option =>
        option
            .setName('allowed_role')
            .setDescription('Only allow users with this role to vote')
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        const acknowledged = await ensurePollAcknowledged(interaction);
        if (!acknowledged) {
            return;
        }

        const guild = interaction.guild;
        if (!guild) {
            await sendPollResponse(interaction, 'This command can only be used in a server.');
            return;
        }

        const policyContext = getCommandPolicyContext(interaction);
        const channel = policyContext?.targetChannel ?? interaction.channel;

        if (!isSupportedPostChannel(channel)) {
            await sendPollResponse(interaction, 'Please specify a valid text channel.');
            return;
        }

        const question = interaction.options.getString('question', true);
        const optionsInput = interaction.options.getString('options', true);
        const description = interaction.options.getString('description');
        const pollType = (interaction.options.getString('type') || 'STANDARD') as 'STANDARD' | 'TIME' | 'ANONYMOUS';
        const allowMultiple = interaction.options.getBoolean('allow_multiple') || false;
        const maxVotes = interaction.options.getInteger('max_votes');
        const allowCustomOptions = interaction.options.getBoolean('allow_custom_options') || false;
        const endTimeInput = interaction.options.getString('end_time');
        const allowedRole = interaction.options.getRole('allowed_role');

        // Parse options
        const options = optionsInput.split(',').map(o => o.trim()).filter(o => o.length > 0);

        if (options.length < 2) {
            await sendPollResponse(interaction, 'Please provide at least 2 options separated by commas.');
            return;
        }

        if (options.length > 25) {
            await sendPollResponse(interaction, 'You can have a maximum of 25 options.');
            return;
        }

        // Parse end time
        let endTime: Date | null = null;
        if (endTimeInput) {
            endTime = parseNaturalLanguageDate(endTimeInput);
            if (!endTime) {
                await sendPollResponse(interaction, 'Invalid end time format. Try something like "in 2 hours" or "tomorrow 5pm".');
                return;
            }
        }

        // For time polls, parse dates from options
        let pollOptions: { text: string; emoji?: string; dateTimeValue?: Date }[];
        
        if (pollType === 'TIME') {
            pollOptions = [];
            for (let i = 0; i < options.length; i++) {
                const parsedDate = parseNaturalLanguageDate(options[i]);
                if (!parsedDate) {
                    await sendPollResponse(interaction, `Could not parse "${options[i]}" as a valid date/time.`);
                    return;
                }
                pollOptions.push({
                    text: formatDiscordTimestamp(parsedDate, 'F'),
                    emoji: ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'][i % 12],
                    dateTimeValue: parsedDate,
                });
            }
        } else {
            // Add number emojis for standard polls
            const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
            pollOptions = options.map((text, i) => ({
                text,
                emoji: numberEmojis[i] || undefined,
            }));
        }

        // Create the poll
        const createdPoll = await pollService.createPoll({
            guildId: guild.id,
            creatorId: interaction.user.id,
            channelId: channel.id,
            question,
            description: description || undefined,
            options: pollOptions,
            type: pollType,
            allowMultipleVotes: allowMultiple,
            maxVotesPerUser: maxVotes || undefined,
            allowCustomOptions,
            allowedRoleIds: allowedRole?.id ? [allowedRole.id] : undefined,
            endTime,
        });

        // Build the poll embed
        const embed = buildPollEmbed(createdPoll, pollOptions, interaction.user.id);

        // Create vote buttons or select menu
        let components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];

        if (pollOptions.length <= 5) {
            // Use buttons for up to 5 options
            const rows: ActionRowBuilder<ButtonBuilder>[] = [];
            let currentRow = new ActionRowBuilder<ButtonBuilder>();

            for (let i = 0; i < pollOptions.length; i++) {
                if (i > 0 && i % 5 === 0) {
                    rows.push(currentRow);
                    currentRow = new ActionRowBuilder<ButtonBuilder>();
                }

                currentRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`poll:vote:${createdPoll.id}:${i}`)
                        .setLabel(pollOptions[i].emoji || `${i + 1}`)
                        .setStyle(ButtonStyle.Primary)
                );
            }

            if (currentRow.components.length > 0) {
                rows.push(currentRow);
            }

            // Add control buttons
            const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`poll:results:${createdPoll.id}`)
                    .setLabel('📊 Results')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`poll:end:${createdPoll.id}`)
                    .setLabel('🔒 Close Poll')
                    .setStyle(ButtonStyle.Danger)
            );

            components = [...rows, controlRow];
        } else {
            // Use select menu for more options
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`poll:vote:${createdPoll.id}`)
                .setPlaceholder(allowMultiple ? 'Select option(s) to vote (or clear to remove)' : 'Select an option to vote (or clear to remove)')
                .setMinValues(0)
                .setMaxValues(allowMultiple ? (maxVotes || pollOptions.length) : 1);

            for (let i = 0; i < pollOptions.length; i++) {
                const opt = pollOptions[i];
                selectMenu.addOptions({
                    label: opt.text.substring(0, 100),
                    value: `${i}`,
                    emoji: opt.emoji,
                });
            }

            const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

            const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`poll:results:${createdPoll.id}`)
                    .setLabel('📊 Results')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`poll:end:${createdPoll.id}`)
                    .setLabel('🔒 Close Poll')
                    .setStyle(ButtonStyle.Danger)
            );

            components = [selectRow, controlRow];
        }

        // Send the poll
        const message = await (channel as any).send({
            embeds: [embed],
            components,
        });

        // Update poll with message ID
        await pollService.setPollMessageId(createdPoll.id, message.id);

        await sendPollResponse(interaction, '✅ Poll created successfully!');

        logger.info(`Poll created: ${createdPoll.id} by ${interaction.user.tag} in ${guild.name}`);

    } catch (error) {
        logger.error('Error creating poll:', error);
        await sendPollResponse(interaction, 'An error occurred while creating the poll. Please try again.');
    }
}

async function ensurePollAcknowledged(interaction: ChatInputCommandInteraction): Promise<boolean> {
    if (interaction.deferred || interaction.replied) {
        return true;
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            await interaction.deferReply({ ephemeral: true });
            return true;
        } catch (error) {
            const retryable = isRetryableNetworkError(error);
            logger.warn(`Failed to defer /poll interaction (attempt ${attempt}/3):`, error);
            if (!retryable || attempt === 3) {
                break;
            }
            await delay(250 * attempt);
        }
    }

    return sendPollResponse(interaction, 'I could not acknowledge this interaction in time. Please run `/poll` again.');
}

async function sendPollResponse(interaction: ChatInputCommandInteraction, content: string): Promise<boolean> {
    if (interaction.deferred || interaction.replied) {
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                await interaction.editReply({ content });
                return true;
            } catch (editError) {
                const retryable = isRetryableNetworkError(editError);
                logger.warn(`Failed to edit /poll interaction reply (attempt ${attempt}/2):`, editError);
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
        logger.warn('Failed to send /poll interaction reply, attempting follow-up:', replyError);
    }

    try {
        await interaction.followUp({ content, ephemeral: true });
        return true;
    } catch (followUpError) {
        logger.error('Failed to send /poll interaction response:', followUpError);
        return false;
    }
}

function isRetryableNetworkError(error: unknown): boolean {
    const code = (error as { code?: string }).code;
    return code === 'EAI_AGAIN' || code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT';
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPollEmbed(
    poll: any,
    options: { text: string; emoji?: string }[],
    creatorId: string
): EmbedBuilder {
    const typeIcons: Record<string, string> = {
        'STANDARD': '📊',
        'TIME': '🕐',
        'ANONYMOUS': '🕵️',
    };

    const embed = new EmbedBuilder()
        .setTitle(`${typeIcons[poll.type] || '📊'} ${poll.question}`)
        .setColor('#5865F2')
        .setFooter({ text: `Poll by @${creatorId} • 0 votes` })
        .setTimestamp();

    if (poll.description) {
        embed.setDescription(poll.description);
    }

    // Add options
    const optionsText = options
        .map((opt, i) => `${opt.emoji || `${i + 1}.`} ${opt.text} - 0 votes (0%)`)
        .join('\n\n');

    embed.addFields({ name: 'Options', value: optionsText || 'No options', inline: false });

    if (poll.allowMultipleVotes) {
        const maxText = poll.maxVotesPerUser ? ` (max ${poll.maxVotesPerUser})` : '';
        embed.addFields({ name: 'Voting', value: `Multiple votes allowed${maxText}`, inline: true });
    }

    if (poll.endTime) {
        embed.addFields({ name: 'Ends', value: formatDiscordTimestamp(poll.endTime, 'R'), inline: true });
    }

    if (poll.allowedRoleIds?.length) {
        embed.addFields({ name: '🔒 Restricted', value: `Only <@&${poll.allowedRoleIds[0]}> can vote`, inline: true });
    }

    return embed;
}

export default {
    data,
    execute,
    moduleId: 'polls',
    policy: {
        creatorPolicy: 'polls',
        postChannelPolicy: 'polls',
        channelOptionName: 'channel',
        requireMemberSendPermissionInTargetChannel: true,
        requireBotSendPermissionInTargetChannel: true,
    },
} as Command;
