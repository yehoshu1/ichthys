import { Events, Interaction, GuildMember, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import logger from '../utils/logger';
import { eventService } from '../services/event-service';
import { pollService } from '../services/poll-service';
import { formatDiscordTimestamp } from '../utils/date-parser';

const name = Events.InteractionCreate;

async function execute(interaction: Interaction) {
    try {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const command = (interaction.client as any).commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                logger.error(`Error executing command ${interaction.commandName}:`, error);
                await safeCommandErrorReply(interaction);
            }
        }

        // Handle button clicks
        if (interaction.isButton()) {
            await handleButtonInteraction(interaction);
        }

        // Handle select menu interactions
        if (interaction.isStringSelectMenu()) {
            await handleSelectMenuInteraction(interaction);
        }

        // Handle modal submissions
        if (interaction.isModalSubmit()) {
            await handleModalSubmit(interaction);
        }

    } catch (error) {
        logger.error('Error in interaction handler:', error);
    }
}

async function handleButtonInteraction(interaction: any) {
    const customId = interaction.customId;

    // Event RSVP buttons: event:rsvp:{eventId}:{status}
    if (customId.startsWith('event:rsvp:')) {
        await handleEventRsvp(interaction, customId);
        return;
    }

    // Event reminder buttons: event:reminder:{eventId}
    if (customId.startsWith('event:reminder:')) {
        await handleEventReminder(interaction, customId);
        return;
    }

    // Event details buttons: event:details:{eventId}
    if (customId.startsWith('event:details:')) {
        await handleEventDetails(interaction, customId);
        return;
    }

    // Poll vote buttons: poll:vote:{pollId}:{optionIndex}
    if (customId.startsWith('poll:vote:')) {
        await handlePollVote(interaction, customId);
        return;
    }

    // Poll results buttons: poll:results:{pollId}
    if (customId.startsWith('poll:results:')) {
        await handlePollResults(interaction, customId);
        return;
    }

    // Poll close buttons: poll:end:{pollId}
    if (customId.startsWith('poll:end:')) {
        await handlePollClose(interaction, customId);
        return;
    }

    // Reminder preset buttons: reminder:preset:{eventId}:{minutes}
    if (customId.startsWith('reminder:preset:')) {
        await handleReminderPreset(interaction, customId);
        return;
    }

    // DM Reminder buttons: dm_reminder:{eventId}:{minutes}
    if (customId.startsWith('dm_reminder:')) {
        await handleDmReminder(interaction, customId);
        return;
    }

    // Custom reminder button: reminder:custom:{eventId}
    if (customId.startsWith('reminder:custom:')) {
        await handleCustomReminder(interaction, customId);
        return;
    }
}

async function handleSelectMenuInteraction(interaction: any) {
    const customId = interaction.customId;

    // Poll vote select menu: poll:vote:{pollId}
    if (customId.startsWith('poll:vote:')) {
        await handlePollVoteSelect(interaction, customId);
        return;
    }
}

async function handleModalSubmit(interaction: any) {
    const customId = interaction.customId;

    // Custom reminder modal: reminder_modal:{eventId}
    if (customId.startsWith('reminder_modal:')) {
        await handleReminderModalSubmit(interaction, customId);
        return;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

async function handleEventRsvp(interaction: any, customId: string) {
    const parts = customId.split(':');
    const eventId = parts[2];
    const status = parts[3] as 'YES' | 'NO' | 'MAYBE';

    // Defer reply immediately to prevent "interaction failed"
    // Use try-catch because if interaction is already acknowledged, this will fail
    try {
        await interaction.deferReply({ ephemeral: true });
    } catch (deferError) {
        logger.warn('Failed to defer reply, interaction may already be acknowledged');
    }

    try {
        const evt = await eventService.getEventById(eventId);
        if (!evt) {
            await safeEditReply(interaction, 'This event no longer exists.');
            return;
        }

        if (evt.status === 'CANCELLED') {
            await safeEditReply(interaction, 'This event has been cancelled.');
            return;
        }

        if (evt.status === 'COMPLETED') {
            await safeEditReply(interaction, 'This event has already ended.');
            return;
        }

        // Check role restrictions
        const member = interaction.member as GuildMember;
        
        if (evt.requiredRoleIds?.length) {
            const hasRequiredRole = evt.requiredRoleIds.some(roleId => member.roles.cache.has(roleId));
            if (!hasRequiredRole) {
                await safeEditReply(interaction, 'You do not have the required role to RSVP to this event.');
                return;
            }
        }

        if (evt.blockedRoleIds?.length) {
            const hasBlockedRole = evt.blockedRoleIds.some(roleId => member.roles.cache.has(roleId));
            if (hasBlockedRole) {
                await safeEditReply(interaction, 'You cannot RSVP to this event due to role restrictions.');
                return;
            }
        }

        // Set RSVP
        const result = await eventService.setRsvp({
            eventId,
            userId: interaction.user.id,
            status,
        });

        if (!result.success) {
            await safeEditReply(interaction, result.message || 'Could not update RSVP.');
            return;
        }

        // Assign attendee role if applicable
        if (status === 'YES' && evt.attendeeRoleId) {
            try {
                await member.roles.add(evt.attendeeRoleId);
            } catch (error) {
                logger.warn(`Could not assign attendee role to ${interaction.user.id}:`, error);
            }
        }

        // Remove attendee role if un-RSVPing
        if (status !== 'YES' && evt.attendeeRoleId) {
            try {
                await member.roles.remove(evt.attendeeRoleId);
            } catch (error) {
                logger.warn(`Could not remove attendee role from ${interaction.user.id}:`, error);
            }
        }

        // Update the Discord message with new RSVP counts
        if (interaction.guild) {
            try {
                // Dynamic import to avoid circular dependency issues
                const { eventDiscordService } = await import('../services/event-discord-service');
                if (eventDiscordService) {
                    await eventDiscordService.updateEventMessage(evt, interaction.guild);
                }
            } catch (error) {
                logger.warn('Could not update event Discord message:', error);
            }
        }

        const statusMessages: Record<string, string> = {
            'YES': '✅ You are now going to this event!',
            'NO': '❌ You are not going to this event.',
            'MAYBE': '🤔 You might go to this event.',
        };

        let message = statusMessages[status];
        if (result.waitlisted) {
            message = '⏳ You have been added to the waitlist. You will be notified if a spot opens up.';
        }

        await safeEditReply(interaction, message);

        // Send DM confirmation with reminder button
        try {
            const dmEmbed = new EmbedBuilder()
                .setTitle('📅 RSVP Confirmation')
                .setColor(evt.color ? parseInt(evt.color.replace('#', ''), 16) : 0x5865F2)
                .setDescription(`You RSVP'd **${status}** for **${evt.title}**`)
                .addFields(
                    { name: 'Event', value: evt.title, inline: false },
                    { name: 'Time', value: formatDiscordTimestamp(evt.startTime, 'F'), inline: false },
                    { name: 'Server', value: interaction.guild?.name || 'Unknown', inline: false }
                );

            // Add reminder button row
            const reminderRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`dm_reminder:${eventId}:0`)
                    .setLabel('On event start')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`dm_reminder:${eventId}:10`)
                    .setLabel('10 minutes before')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`dm_reminder:${eventId}:60`)
                    .setLabel('1 hour before')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`dm_reminder:${eventId}:1440`)
                    .setLabel('1 day before')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`dm_reminder:${eventId}:10080`)
                    .setLabel('1 week before')
                    .setStyle(ButtonStyle.Secondary)
            );

            await interaction.user.send({ 
                embeds: [dmEmbed], 
                components: [reminderRow] 
            });
        } catch (dmError) {
            logger.warn(`Could not send DM to ${interaction.user.id}:`, dmError);
        }

    } catch (error) {
        logger.error('Error handling event RSVP:', error);
        await safeEditReply(interaction, 'An error occurred. Please try again.');
    }
}

// Helper function to safely edit reply
async function safeEditReply(interaction: any, content: string) {
    try {
        if (interaction.deferred) {
            await interaction.editReply({ content });
        } else if (!interaction.replied) {
            await interaction.reply({ content, ephemeral: true });
        }
    } catch (error) {
        logger.warn('Failed to send reply:', error);
    }
}

async function safeCommandErrorReply(interaction: any) {
    const payload = {
        content: 'There was an error executing this command!',
        ephemeral: true,
    };

    if (interaction.deferred || interaction.replied) {
        try {
            await interaction.editReply({ content: payload.content });
            return;
        } catch (editError) {
            logger.warn('Failed to edit command error reply, attempting fallback reply:', editError);
        }
    }

    try {
        await interaction.reply(payload);
        return;
    } catch (replyError) {
        logger.warn('Failed to send command error reply, attempting follow-up:', replyError);
    }

    try {
        await interaction.followUp(payload);
    } catch (followUpError) {
        logger.warn('Failed to send command error follow-up:', followUpError);
    }
}

async function handleEventReminder(interaction: any, customId: string) {
    const eventId = customId.split(':')[2];

    try {
        const evt = await eventService.getEventById(eventId);
        if (!evt) {
            await interaction.reply({ content: 'This event no longer exists.', ephemeral: true });
            return;
        }

        // Show preset reminder options
        const embed = new EmbedBuilder()
            .setTitle('⏰ Set Reminder')
            .setDescription(`Set a reminder for **${evt.title}**`)
            .setColor('#5865F2');

        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`reminder:preset:${eventId}:0`)
                .setLabel('On event start')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`reminder:preset:${eventId}:10`)
                .setLabel('10 minutes before')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`reminder:preset:${eventId}:60`)
                .setLabel('1 hour before')
                .setStyle(ButtonStyle.Primary)
        );

        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`reminder:preset:${eventId}:1440`)
                .setLabel('1 day before')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`reminder:preset:${eventId}:10080`)
                .setLabel('1 week before')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`reminder:custom:${eventId}`)
                .setLabel('Custom')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
            embeds: [embed],
            components: [row1, row2],
            ephemeral: true,
        });

    } catch (error) {
        logger.error('Error handling event reminder:', error);
        await interaction.reply({ content: 'An error occurred. Please try again.', ephemeral: true });
    }
}

async function handleEventDetails(interaction: any, customId: string) {
    const eventId = customId.split(':')[2];

    try {
        const evt = await eventService.getEventById(eventId);
        if (!evt) {
            await interaction.reply({ content: 'This event no longer exists.', ephemeral: true });
            return;
        }

        const rsvpCounts = await eventService.getRsvpCounts(eventId);
        const userRsvp = await eventService.getRsvp(eventId, interaction.user.id);

        const embed = new EmbedBuilder()
            .setTitle('📋 Event Details')
            .setColor('#5865F2')
            .addFields(
                { name: 'Title', value: evt.title, inline: false },
                { name: 'Description', value: evt.description || 'No description', inline: false },
                { name: 'Starts', value: formatDiscordTimestamp(evt.startTime, 'F'), inline: false },
                { name: 'Location', value: evt.location || 'Not specified', inline: true },
                { name: 'Your Status', value: userRsvp?.status || 'Not responded', inline: true },
                { name: 'Attendees', value: `✅ ${rsvpCounts.yes} | 🤔 ${rsvpCounts.maybe} | ❌ ${rsvpCounts.no}`, inline: true }
            );

        await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
        logger.error('Error handling event details:', error);
        await interaction.reply({ content: 'An error occurred. Please try again.', ephemeral: true });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POLL HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

async function handlePollVote(interaction: any, customId: string) {
    const parts = customId.split(':');
    const pollId = parts[2];
    const optionIndex = parseInt(parts[3]);

    await interaction.deferReply({ ephemeral: true });

    try {
        const pollData = await pollService.getPollWithOptions(pollId);
        if (!pollData) {
            await interaction.editReply({ content: 'This poll no longer exists.' });
            return;
        }

        if (pollData.poll.closed) {
            await interaction.editReply({ content: 'This poll is closed.' });
            return;
        }

        // Check role restrictions
        const member = interaction.member as GuildMember;
        if (pollData.poll.allowedRoleIds?.length) {
            const hasAllowedRole = pollData.poll.allowedRoleIds.some(roleId => member.roles.cache.has(roleId));
            if (!hasAllowedRole) {
                await interaction.editReply({
                    content: 'You do not have permission to vote in this poll.',
                });
                return;
            }
        }

        const option = pollData.options[optionIndex];
        if (!option) {
            await interaction.editReply({ content: 'Invalid option.' });
            return;
        }

        const result = await pollService.castVote({
            pollId,
            optionId: option.id,
            userId: interaction.user.id,
        });

        if (!result.success) {
            await interaction.editReply({ content: result.message || 'Could not cast vote.' });
            return;
        }

        // Update Discord message with new vote counts
        if (interaction.guild) {
            try {
                const { pollDiscordService } = await import('../services/poll-discord-service');
                if (pollDiscordService) {
                    await pollDiscordService.updateVoteDisplay(pollId, interaction.guild);
                }
            } catch (error) {
                logger.warn('Could not update poll Discord message:', error);
            }
        }

        const message = result.message === 'Vote removed'
            ? `Your vote for "${option.text}" has been removed.`
            : `You voted for "${option.text}"`;

        await interaction.editReply({ content: message });

    } catch (error) {
        logger.error('Error handling poll vote:', error);
        await interaction.editReply({ content: 'An error occurred. Please try again.' });
    }
}

async function handlePollVoteSelect(interaction: any, customId: string) {
    const pollId = customId.split(':')[2];
    const selectedOptions = interaction.values
        .map((v: string) => parseInt(v, 10))
        .filter((v: number) => !Number.isNaN(v));

    await interaction.deferReply({ ephemeral: true });

    try {
        const pollData = await pollService.getPollWithOptions(pollId);
        if (!pollData) {
            await interaction.editReply({ content: 'This poll no longer exists.' });
            return;
        }

        if (pollData.poll.closed) {
            await interaction.editReply({ content: 'This poll is closed.' });
            return;
        }

        // Check role restrictions
        const member = interaction.member as GuildMember;
        if (pollData.poll.allowedRoleIds?.length) {
            const hasAllowedRole = pollData.poll.allowedRoleIds.some(roleId => member.roles.cache.has(roleId));
            if (!hasAllowedRole) {
                await interaction.editReply({
                    content: 'You do not have permission to vote in this poll.',
                });
                return;
            }
        }

        // Remove all existing votes first
        await pollService.removeAllUserVotes(pollId, interaction.user.id, pollData.poll.type === 'ANONYMOUS');

        if (selectedOptions.length === 0) {
            // Empty submit means user cleared all selections and wants to remove votes.
            if (interaction.guild) {
                try {
                    const { pollDiscordService } = await import('../services/poll-discord-service');
                    if (pollDiscordService) {
                        await pollDiscordService.updateVoteDisplay(pollId, interaction.guild);
                    }
                } catch (error) {
                    logger.warn('Could not update poll Discord message:', error);
                }
            }

            await interaction.editReply({
                content: 'Your poll responses have been removed.',
            });
            return;
        }

        // Cast new votes
        for (const optionIndex of selectedOptions) {
            const option = pollData.options[optionIndex];
            if (option) {
                const result = await pollService.castVote({
                    pollId,
                    optionId: option.id,
                    userId: interaction.user.id,
                });

                if (!result.success) {
                    await interaction.editReply({ content: result.message || 'Could not cast vote.' });
                    return;
                }
            }
        }

        // Update Discord message with new vote counts
        if (interaction.guild) {
            try {
                const { pollDiscordService } = await import('../services/poll-discord-service');
                if (pollDiscordService) {
                    await pollDiscordService.updateVoteDisplay(pollId, interaction.guild);
                }
            } catch (error) {
                logger.warn('Could not update poll Discord message:', error);
            }
        }

        const selectedTexts = selectedOptions
            .map((idx: number) => pollData.options[idx]?.text)
            .filter(Boolean);

        await interaction.editReply({
            content: `You voted for: ${selectedTexts.join(', ')}`,
        });

    } catch (error) {
        logger.error('Error handling poll vote select:', error);
        await interaction.editReply({ content: 'An error occurred. Please try again.' });
    }
}

async function handlePollResults(interaction: any, customId: string) {
    const pollId = customId.split(':')[2];

    try {
        const results = await pollService.getResults(pollId);
        const pollData = await pollService.getPollWithOptions(pollId);

        if (!pollData) {
            await interaction.reply({ content: 'This poll no longer exists.', ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('📊 Poll Results')
            .setDescription(pollData.poll.question)
            .setColor('#5865F2')
            .setFooter({ text: `${results.totalVotes} total vote${results.totalVotes !== 1 ? 's' : ''}` });

        const showVoters = pollData.poll.type !== 'ANONYMOUS';
        const resultsText = results.options.map((opt, i) => {
            const bar = '█'.repeat(Math.round(opt.percentage / 5)) + '░'.repeat(20 - Math.round(opt.percentage / 5));
            if (!showVoters || !opt.voters || opt.voters.length === 0) {
                return `${i + 1}. ${opt.option.text}\n\`${bar}\` ${opt.percentage}% (${opt.voteCount})`;
            }

            const maxVisible = 10;
            const visibleVoters = opt.voters.slice(0, maxVisible).map((userId: string) => `<@${userId}>`);
            const remaining = opt.voters.length - visibleVoters.length;
            const voterText = remaining > 0
                ? `${visibleVoters.join(', ')} +${remaining} more`
                : visibleVoters.join(', ');

            return `${i + 1}. ${opt.option.text}\n\`${bar}\` ${opt.percentage}% (${opt.voteCount})\n👥 ${voterText}`;
        }).join('\n\n');

        embed.addFields({
            name: showVoters ? 'Results (With Voters)' : 'Results',
            value: truncatePollResults(resultsText || 'No votes yet'),
            inline: false,
        });

        if (!showVoters) {
            embed.addFields({
                name: 'Privacy',
                value: '🕵️ This is an anonymous poll. Voter identities are hidden.',
                inline: false,
            });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
        logger.error('Error handling poll results:', error);
        await interaction.reply({ content: 'An error occurred. Please try again.', ephemeral: true });
    }
}

function truncatePollResults(value: string): string {
    const maxLength = 1024;
    if (value.length <= maxLength) {
        return value;
    }

    return `${value.slice(0, maxLength - 15)}\n…(truncated)`;
}

async function handlePollClose(interaction: any, customId: string) {
    const pollId = customId.split(':')[2];

    try {
        const pollData = await pollService.getPollById(pollId);
        if (!pollData) {
            await interaction.reply({ content: 'This poll no longer exists.', ephemeral: true });
            return;
        }

        // Check permissions
        const member = interaction.member as GuildMember;
        const isCreator = pollData.creatorId === interaction.user.id;
        const isAdmin = member.permissions.has(PermissionFlagsBits.ManageGuild) ||
                        member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isCreator && !isAdmin) {
            await interaction.reply({
                content: 'Only the poll creator or administrators can close this poll.',
                ephemeral: true,
            });
            return;
        }

        const updatedPoll = await pollService.closePoll(pollId);

        // Update the Discord message
        if (interaction.guild && updatedPoll) {
            try {
                const { pollDiscordService } = await import('../services/poll-discord-service');
                if (pollDiscordService) {
                    await pollDiscordService.updatePollMessage(updatedPoll, interaction.guild);
                }
            } catch (syncError) {
                logger.warn('Could not sync closed poll Discord message:', syncError);
            }
        }

        await interaction.reply({ content: 'Poll closed successfully.', ephemeral: true });

    } catch (error) {
        logger.error('Error handling poll close:', error);
        await interaction.reply({ content: 'An error occurred. Please try again.', ephemeral: true });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REMINDER HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

async function handleReminderPreset(interaction: any, customId: string) {
    const parts = customId.split(':');
    const eventId = parts[2];
    const minutes = parseInt(parts[3]);

    try {
        const evt = await eventService.getEventById(eventId);
        if (!evt) {
            await interaction.reply({ content: 'This event no longer exists.', ephemeral: true });
            return;
        }

        const reminderTime = new Date(evt.startTime.getTime() - minutes * 60000);
        if (reminderTime < new Date()) {
            await interaction.reply({ content: 'That reminder time has already passed.', ephemeral: true });
            return;
        }

        const reminderResult = await eventService.upsertReminder(eventId, interaction.user.id, minutes);

        if (reminderResult.status === 'unchanged') {
            await interaction.reply({ content: 'You already have a reminder set for that time.', ephemeral: true });
            return;
        }

        const timeLabel = formatReminderLabel(minutes);
        const reminderPrefix = reminderResult.status === 'updated' ? '✅ Reminder updated!' : '✅ Reminder set!';
        const reminderMessage = minutes === 0
            ? `${reminderPrefix} You will be notified when the event starts.`
            : `${reminderPrefix} You will be notified **${timeLabel}** before the event starts.`;

        await interaction.reply({
            content: reminderMessage,
            ephemeral: true,
        });

    } catch (error) {
        logger.error('Error handling reminder preset:', error);
        await interaction.reply({ content: 'An error occurred. Please try again.', ephemeral: true });
    }
}

async function handleCustomReminder(interaction: any, customId: string) {
    const eventId = customId.split(':')[2];

    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');

    const modal = new ModalBuilder()
        .setCustomId(`reminder_modal:${eventId}`)
        .setTitle('Set Custom Reminder');

    const timeInput = new TextInputBuilder()
        .setCustomId('reminder_time')
        .setLabel('Minutes before the event')
        .setPlaceholder('e.g., 45')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(5);

    const row = new ActionRowBuilder<any>().addComponents(timeInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
}

async function handleReminderModalSubmit(interaction: any, customId: string) {
    const eventId = customId.split(':')[2];
    const minutesStr = interaction.fields.getTextInputValue('reminder_time');
    const minutes = parseInt(minutesStr);

    if (isNaN(minutes) || minutes < 0) {
        await interaction.reply({ content: 'Invalid number of minutes.', ephemeral: true });
        return;
    }

    try {
        const evt = await eventService.getEventById(eventId);
        if (!evt) {
            await interaction.reply({ content: 'This event no longer exists.', ephemeral: true });
            return;
        }

        const reminderTime = new Date(evt.startTime.getTime() - minutes * 60000);
        if (reminderTime < new Date()) {
            await interaction.reply({ content: 'That reminder time has already passed.', ephemeral: true });
            return;
        }

        const reminderResult = await eventService.upsertReminder(eventId, interaction.user.id, minutes);

        if (reminderResult.status === 'unchanged') {
            await interaction.reply({ content: 'You already have a reminder set for that time.', ephemeral: true });
            return;
        }
        const reminderPrefix = reminderResult.status === 'updated' ? '✅ Reminder updated!' : '✅ Reminder set!';
        const reminderMessage = minutes === 0
            ? `${reminderPrefix} You will be notified when the event starts.`
            : `${reminderPrefix} You will be notified **${formatReminderLabel(minutes)}** before the event starts.`;

        await interaction.reply({
            content: reminderMessage,
            ephemeral: true,
        });

    } catch (error) {
        logger.error('Error handling reminder modal submit:', error);
        await interaction.reply({ content: 'An error occurred. Please try again.', ephemeral: true });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DM REMINDER HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

async function handleDmReminder(interaction: any, customId: string) {
    const parts = customId.split(':');
    const eventId = parts[1];
    const minutes = parseInt(parts[2]);

    try {
        // Defer update to prevent "interaction failed"
        await interaction.deferUpdate();

        const evt = await eventService.getEventById(eventId);
        if (!evt) {
            await interaction.followUp({ content: 'This event no longer exists.', ephemeral: true });
            return;
        }

        const reminderTime = new Date(evt.startTime.getTime() - minutes * 60000);
        if (reminderTime < new Date()) {
            await interaction.followUp({ content: 'That reminder time has already passed.', ephemeral: true });
            return;
        }

        const reminderResult = await eventService.upsertReminder(eventId, interaction.user.id, minutes);

        if (reminderResult.status === 'unchanged') {
            await interaction.followUp({ content: 'You already have a reminder set for that time.', ephemeral: true });
            return;
        }

        const timeLabel = formatReminderLabel(minutes);
        const reminderPrefix = reminderResult.status === 'updated' ? '✅ Reminder updated!' : '✅ Reminder set!';

        await interaction.editReply({
            content: minutes === 0
                ? `${reminderPrefix} I'll DM you when the event starts.`
                : `${reminderPrefix} I'll DM you **${timeLabel}** before the event starts.`,
            components: interaction.message.components,
            embeds: interaction.message.embeds,
        });

    } catch (error) {
        logger.error('Error handling DM reminder:', error);
        await interaction.followUp({ content: 'An error occurred. Please try again.', ephemeral: true });
    }
}

function formatReminderLabel(minutes: number): string {
    if (minutes === 0) return 'on event start';
    if (minutes < 60) return `${minutes} minutes`;
    if (minutes < 1440) return `${minutes / 60} hours`;
    if (minutes < 10080) return `${minutes / 1440} days`;
    return `${minutes / 10080} weeks`;
}

export default { name, execute };
