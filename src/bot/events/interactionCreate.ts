import { Events, Interaction, GuildMember, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import logger from '../utils/logger';
import { eventService } from '../services/event-service';
import { pollService } from '../services/poll-service';
import { formatDiscordTimestamp } from '../utils/date-parser';

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction) {
    try {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const command = (interaction.client as any).commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                logger.error(`Error executing command ${interaction.commandName}:`, error);
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({
                        content: 'There was an error executing this command!',
                    }).catch(() => {});
                } else {
                    await interaction.reply({
                        content: 'There was an error executing this command!',
                        ephemeral: true,
                    }).catch(() => {});
                }
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

    try {
        const evt = await eventService.getEventById(eventId);
        if (!evt) {
            await interaction.reply({ content: 'This event no longer exists.', ephemeral: true });
            return;
        }

        if (evt.status === 'CANCELLED') {
            await interaction.reply({ content: 'This event has been cancelled.', ephemeral: true });
            return;
        }

        if (evt.status === 'COMPLETED') {
            await interaction.reply({ content: 'This event has already ended.', ephemeral: true });
            return;
        }

        // Check role restrictions
        const member = interaction.member as GuildMember;
        
        if (evt.requiredRoleIds?.length) {
            const hasRequiredRole = evt.requiredRoleIds.some(roleId => member.roles.cache.has(roleId));
            if (!hasRequiredRole) {
                await interaction.reply({ 
                    content: 'You do not have the required role to RSVP to this event.', 
                    ephemeral: true 
                });
                return;
            }
        }

        if (evt.blockedRoleIds?.length) {
            const hasBlockedRole = evt.blockedRoleIds.some(roleId => member.roles.cache.has(roleId));
            if (hasBlockedRole) {
                await interaction.reply({ 
                    content: 'You cannot RSVP to this event due to role restrictions.', 
                    ephemeral: true 
                });
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
            await interaction.reply({ content: result.message || 'Could not update RSVP.', ephemeral: true });
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

        // Update the embed with new counts
        await updateEventEmbed(interaction, evt);

        const statusMessages: Record<string, string> = {
            'YES': '✅ You are now going to this event!',
            'NO': '❌ You are not going to this event.',
            'MAYBE': '🤔 You might go to this event.',
        };

        let message = statusMessages[status];
        if (result.waitlisted) {
            message = '⏳ You have been added to the waitlist. You will be notified if a spot opens up.';
        }

        await interaction.reply({ content: message, ephemeral: true });

        // Send DM confirmation
        try {
            const dmEmbed = new EmbedBuilder()
                .setTitle('📅 RSVP Confirmation')
                .setColor('#5865F2')
                .setDescription(`You RSVP'd **${status}** for **${evt.title}**`)
                .addFields(
                    { name: 'Event', value: evt.title, inline: false },
                    { name: 'Time', value: formatDiscordTimestamp(evt.startTime, 'F'), inline: false },
                    { name: 'Server', value: interaction.guild?.name || 'Unknown', inline: false }
                );

            await interaction.user.send({ embeds: [dmEmbed] });
        } catch {
            // DM failed, ignore
        }

    } catch (error) {
        logger.error('Error handling event RSVP:', error);
        await interaction.reply({ content: 'An error occurred. Please try again.', ephemeral: true });
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
                .setCustomId(`reminder:preset:${eventId}:10`)
                .setLabel('10 minutes before')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`reminder:preset:${eventId}:30`)
                .setLabel('30 minutes before')
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

async function updateEventEmbed(interaction: any, evt: any) {
    try {
        const rsvpCounts = await eventService.getRsvpCounts(evt.id);
        const message = interaction.message;

        if (!message || !message.embeds || message.embeds.length === 0) return;

        const oldEmbed = message.embeds[0];
        const newEmbed = EmbedBuilder.from(oldEmbed);

        // Update the attendees field
        const attendeesFieldIndex = oldEmbed.fields?.findIndex((f: any) => f.name === 'Attendees');
        if (attendeesFieldIndex !== undefined && attendeesFieldIndex >= 0) {
            const attendeesValue = `✅ ${rsvpCounts.yes} going | 🤔 ${rsvpCounts.maybe} maybe | ❌ ${rsvpCounts.no} not going`;
            newEmbed.spliceFields(attendeesFieldIndex, 1, {
                name: 'Attendees',
                value: attendeesValue,
                inline: false,
            });
        }

        await message.edit({ embeds: [newEmbed] });
    } catch (error) {
        logger.error('Error updating event embed:', error);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POLL HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

async function handlePollVote(interaction: any, customId: string) {
    const parts = customId.split(':');
    const pollId = parts[2];
    const optionIndex = parseInt(parts[3]);

    try {
        const pollData = await pollService.getPollWithOptions(pollId);
        if (!pollData) {
            await interaction.reply({ content: 'This poll no longer exists.', ephemeral: true });
            return;
        }

        if (pollData.poll.closed) {
            await interaction.reply({ content: 'This poll is closed.', ephemeral: true });
            return;
        }

        // Check role restrictions
        const member = interaction.member as GuildMember;
        if (pollData.poll.allowedRoleIds?.length) {
            const hasAllowedRole = pollData.poll.allowedRoleIds.some(roleId => member.roles.cache.has(roleId));
            if (!hasAllowedRole) {
                await interaction.reply({
                    content: 'You do not have permission to vote in this poll.',
                    ephemeral: true,
                });
                return;
            }
        }

        const option = pollData.options[optionIndex];
        if (!option) {
            await interaction.reply({ content: 'Invalid option.', ephemeral: true });
            return;
        }

        const result = await pollService.castVote({
            pollId,
            optionId: option.id,
            userId: interaction.user.id,
        });

        if (!result.success) {
            await interaction.reply({ content: result.message || 'Could not cast vote.', ephemeral: true });
            return;
        }

        // Update poll embed
        await updatePollEmbed(interaction, pollData.poll);

        const message = result.message === 'Vote removed'
            ? `Your vote for "${option.text}" has been removed.`
            : `You voted for "${option.text}"`;

        await interaction.reply({ content: message, ephemeral: true });

    } catch (error) {
        logger.error('Error handling poll vote:', error);
        await interaction.reply({ content: 'An error occurred. Please try again.', ephemeral: true });
    }
}

async function handlePollVoteSelect(interaction: any, customId: string) {
    const pollId = customId.split(':')[2];
    const selectedOptions = interaction.values.map((v: string) => parseInt(v));

    try {
        const pollData = await pollService.getPollWithOptions(pollId);
        if (!pollData) {
            await interaction.reply({ content: 'This poll no longer exists.', ephemeral: true });
            return;
        }

        if (pollData.poll.closed) {
            await interaction.reply({ content: 'This poll is closed.', ephemeral: true });
            return;
        }

        // Check role restrictions
        const member = interaction.member as GuildMember;
        if (pollData.poll.allowedRoleIds?.length) {
            const hasAllowedRole = pollData.poll.allowedRoleIds.some(roleId => member.roles.cache.has(roleId));
            if (!hasAllowedRole) {
                await interaction.reply({
                    content: 'You do not have permission to vote in this poll.',
                    ephemeral: true,
                });
                return;
            }
        }

        // Remove all existing votes first
        await pollService.removeAllUserVotes(pollId, interaction.user.id);

        // Cast new votes
        for (const optionIndex of selectedOptions) {
            const option = pollData.options[optionIndex];
            if (option) {
                await pollService.castVote({
                    pollId,
                    optionId: option.id,
                    userId: interaction.user.id,
                });
            }
        }

        // Update poll embed
        await updatePollEmbed(interaction, pollData.poll);

        const selectedTexts = selectedOptions
            .map((idx: number) => pollData.options[idx]?.text)
            .filter(Boolean);

        await interaction.reply({
            content: `You voted for: ${selectedTexts.join(', ')}`,
            ephemeral: true,
        });

    } catch (error) {
        logger.error('Error handling poll vote select:', error);
        await interaction.reply({ content: 'An error occurred. Please try again.', ephemeral: true });
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

        const resultsText = results.options.map((opt, i) => {
            const bar = '█'.repeat(Math.round(opt.percentage / 5)) + '░'.repeat(20 - Math.round(opt.percentage / 5));
            return `${i + 1}. ${opt.option.text}\n\`${bar}\` ${opt.percentage}% (${opt.voteCount})`;
        }).join('\n\n');

        embed.addFields({ name: 'Results', value: resultsText || 'No votes yet', inline: false });

        await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
        logger.error('Error handling poll results:', error);
        await interaction.reply({ content: 'An error occurred. Please try again.', ephemeral: true });
    }
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

        await pollService.closePoll(pollId);

        // Update the message to show it's closed
        const message = interaction.message;
        if (message) {
            const oldEmbed = message.embeds[0];
            const newEmbed = EmbedBuilder.from(oldEmbed)
                .setTitle(`🔒 ${oldEmbed.title}`)
                .setColor('#999999')
                .setFooter({ text: 'This poll is closed' });

            await message.edit({ embeds: [newEmbed], components: [] });
        }

        await interaction.reply({ content: 'Poll closed successfully.', ephemeral: true });

    } catch (error) {
        logger.error('Error handling poll close:', error);
        await interaction.reply({ content: 'An error occurred. Please try again.', ephemeral: true });
    }
}

async function updatePollEmbed(interaction: any, poll: any) {
    try {
        const results = await pollService.getResults(poll.id);
        const message = interaction.message;

        if (!message || !message.embeds || message.embeds.length === 0) return;

        const oldEmbed = message.embeds[0];
        const newEmbed = EmbedBuilder.from(oldEmbed);

        // Update the options field
        const optionsFieldIndex = oldEmbed.fields?.findIndex((f: any) => f.name === 'Options');
        if (optionsFieldIndex !== undefined && optionsFieldIndex >= 0) {
            const optionsText = results.options.map((opt, i) => {
                const emoji = opt.option.emoji || `${i + 1}.`;
                return `${emoji} ${opt.option.text} - ${opt.voteCount} votes (${opt.percentage}%)`;
            }).join('\n');

            newEmbed.spliceFields(optionsFieldIndex, 1, {
                name: 'Options',
                value: optionsText || 'No options',
                inline: false,
            });
        }

        // Update footer
        newEmbed.setFooter({ text: `Poll by @${poll.creatorId} • ${results.totalVotes} votes` });

        await message.edit({ embeds: [newEmbed] });
    } catch (error) {
        logger.error('Error updating poll embed:', error);
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

        const success = await eventService.setReminder(eventId, interaction.user.id, minutes);

        if (!success) {
            await interaction.reply({ content: 'You already have a reminder set for that time.', ephemeral: true });
            return;
        }

        const timeLabel = minutes < 60 
            ? `${minutes} minutes` 
            : minutes < 1440 
                ? `${minutes / 60} hours` 
                : `${minutes / 1440} days`;

        await interaction.reply({
            content: `✅ Reminder set! You will be notified **${timeLabel}** before the event starts.`,
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

    if (isNaN(minutes) || minutes <= 0) {
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

        const success = await eventService.setReminder(eventId, interaction.user.id, minutes);

        if (!success) {
            await interaction.reply({ content: 'You already have a reminder set for that time.', ephemeral: true });
            return;
        }

        await interaction.reply({
            content: `✅ Reminder set! You will be notified **${minutes} minutes** before the event starts.`,
            ephemeral: true,
        });

    } catch (error) {
        logger.error('Error handling reminder modal submit:', error);
        await interaction.reply({ content: 'An error occurred. Please try again.', ephemeral: true });
    }
}
