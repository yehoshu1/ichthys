import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    GuildMember,
    type ButtonInteraction,
    type ModalSubmitInteraction,
} from 'discord.js';
import { eventService } from '../../services/event-service';
import logger from '../../utils/logger';
import { formatDiscordTimestamp } from '../../utils/date-parser';
import type { ComponentRouter } from '../component-router';

async function safeEditReply(interaction: ButtonInteraction, content: string): Promise<void> {
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

function formatReminderLabel(minutes: number): string {
    if (minutes === 0) return 'on event start';
    if (minutes < 60) return `${minutes} minutes`;
    if (minutes < 1440) return `${minutes / 60} hours`;
    if (minutes < 10080) return `${minutes / 1440} days`;
    return `${minutes / 10080} weeks`;
}

async function handleEventRsvp(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;
    const parts = customId.split(':');
    const eventId = parts[2];
    const status = parts[3] as 'YES' | 'NO' | 'MAYBE';

    try {
        await interaction.deferReply({ ephemeral: true });
    } catch {
        logger.warn('Failed to defer reply, interaction may already be acknowledged');
    }

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

    const member = interaction.member as GuildMember;

    if (evt.requiredRoleIds?.length) {
        const hasRequiredRole = evt.requiredRoleIds.some((roleId) => member.roles.cache.has(roleId));
        if (!hasRequiredRole) {
            await safeEditReply(interaction, 'You do not have the required role to RSVP to this event.');
            return;
        }
    }

    if (evt.blockedRoleIds?.length) {
        const hasBlockedRole = evt.blockedRoleIds.some((roleId) => member.roles.cache.has(roleId));
        if (hasBlockedRole) {
            await safeEditReply(interaction, 'You cannot RSVP to this event due to role restrictions.');
            return;
        }
    }

    const result = await eventService.setRsvp({
        eventId,
        userId: interaction.user.id,
        status,
    });

    if (!result.success) {
        await safeEditReply(interaction, result.message || 'Could not update RSVP.');
        return;
    }

    if (status === 'YES' && evt.attendeeRoleId) {
        await member.roles.add(evt.attendeeRoleId).catch((error) => {
            logger.warn(`Could not assign attendee role to ${interaction.user.id}:`, error);
        });
    }

    if (status !== 'YES' && evt.attendeeRoleId) {
        await member.roles.remove(evt.attendeeRoleId).catch((error) => {
            logger.warn(`Could not remove attendee role from ${interaction.user.id}:`, error);
        });
    }

    if (interaction.guild) {
        try {
            const { eventDiscordService } = await import('../../services/event-discord-service');
            if (eventDiscordService) {
                await eventDiscordService.updateEventMessage(evt, interaction.guild);
            }
        } catch (error) {
            logger.warn('Could not update event Discord message:', error);
        }
    }

    const statusMessages: Record<string, string> = {
        YES: '✅ You are now going to this event!',
        NO: '❌ You are not going to this event.',
        MAYBE: '🤔 You might go to this event.',
    };

    let message = statusMessages[status];
    if (result.waitlisted) {
        message = '⏳ You have been added to the waitlist. You will be notified if a spot opens up.';
    }

    await safeEditReply(interaction, message);

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

        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`dm_reminder:${eventId}:0`).setLabel('On event start').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`dm_reminder:${eventId}:10`).setLabel('10 minutes before').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`dm_reminder:${eventId}:60`).setLabel('1 hour before').setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`dm_reminder:${eventId}:1440`).setLabel('1 day before').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`reminder:custom:${eventId}`).setLabel('Custom').setStyle(ButtonStyle.Secondary)
        );

        await interaction.user.send({ embeds: [dmEmbed], components: [row1, row2] });
    } catch (dmError) {
        logger.warn(`Could not send DM to ${interaction.user.id}:`, dmError);
    }
}

async function handleEventReminder(interaction: ButtonInteraction): Promise<void> {
    const eventId = interaction.customId.split(':')[2];
    const evt = await eventService.getEventById(eventId);
    if (!evt) {
        await interaction.reply({ content: 'This event no longer exists.', ephemeral: true });
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle('⏰ Set Reminder')
        .setDescription(`Set a reminder for **${evt.title}**`)
        .setColor('#5865F2');

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`reminder:preset:${eventId}:0`).setLabel('On event start').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`reminder:preset:${eventId}:10`).setLabel('10 minutes before').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`reminder:preset:${eventId}:60`).setLabel('1 hour before').setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`reminder:preset:${eventId}:1440`).setLabel('1 day before').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`reminder:custom:${eventId}`).setLabel('Custom').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
        embeds: [embed],
        components: [row1, row2],
        ephemeral: true,
    });
}

async function handleEventDetails(interaction: ButtonInteraction): Promise<void> {
    const eventId = interaction.customId.split(':')[2];
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
}

async function handleReminderPreset(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const eventId = parts[2];
    const minutes = parseInt(parts[3], 10);

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

    await interaction.reply({ content: reminderMessage, ephemeral: true });
}

async function handleCustomReminder(interaction: ButtonInteraction): Promise<void> {
    const eventId = interaction.customId.split(':')[2];
    const { ModalBuilder, TextInputBuilder, TextInputStyle } = await import('discord.js');

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

async function handleReminderModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    const eventId = interaction.customId.split(':')[2];
    const minutesStr = interaction.fields.getTextInputValue('reminder_time');
    const minutes = parseInt(minutesStr, 10);

    if (Number.isNaN(minutes) || minutes < 0) {
        await interaction.reply({ content: 'Invalid number of minutes.', ephemeral: true });
        return;
    }

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

    await interaction.reply({ content: reminderMessage, ephemeral: true });
}

async function handleDmReminder(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const eventId = parts[1];
    const minutes = parseInt(parts[2], 10);

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
}

async function handleEventSettings(interaction: ButtonInteraction): Promise<void> {
    const eventId = interaction.customId.split(':')[2];
    const evt = await eventService.getEventById(eventId);
    if (!evt) {
        await interaction.reply({ content: 'This event no longer exists.', ephemeral: true });
        return;
    }

    const userRsvp = await eventService.getRsvp(eventId, interaction.user.id);
    const rsvpStatus = userRsvp ? userRsvp.status : 'None';

    const embed = new EmbedBuilder()
        .setTitle('⚙️ Event Settings')
        .setDescription(`What would you like to do with event **${evt.title}**?\n\n**Current RSVP:** ${rsvpStatus}`)
        .setColor('#5865F2');

    const isAdminOrCreator = interaction.memberPermissions?.has('Administrator') || interaction.user.id === evt.creatorId;

    const row = new ActionRowBuilder<ButtonBuilder>();

    if (isAdminOrCreator) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`event_action:edit:${eventId}`)
                .setLabel('✏️ Edit')
                .setStyle(ButtonStyle.Primary)
        );
    }

    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`event_action:rsvpers:${eventId}`)
            .setLabel('👥 View RSVPers')
            .setStyle(ButtonStyle.Secondary)
    );

    if (userRsvp) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`event_action:unrsvp:${eventId}`)
                .setLabel('🗑️ UnRSVP')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    if (isAdminOrCreator) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`event_action:delete:${eventId}`)
                .setLabel('🧨 Delete')
                .setStyle(ButtonStyle.Danger)
        );
    }

    await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true,
    });
}

async function handleEventEdit(interaction: ButtonInteraction): Promise<void> {
    const eventId = interaction.customId.split(':')[2];
    const guildId = interaction.guildId;
    
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
    
    await interaction.reply({ 
        content: `To edit this event, please visit the dashboard:\n${dashboardUrl}/dashboard/${guildId}/events?event=${eventId}`, 
        ephemeral: true 
    });
}

async function handleEventRsvpers(interaction: ButtonInteraction): Promise<void> {
    const eventId = interaction.customId.split(':')[2];
    const evt = await eventService.getEventById(eventId);
    if (!evt) {
        await interaction.reply({ content: 'This event no longer exists.', ephemeral: true });
        return;
    }

    const rsvps = await eventService.getRsvpsByEvent(eventId);
    const yes = rsvps.filter(r => r.status === 'YES');
    const maybe = rsvps.filter(r => r.status === 'MAYBE');
    const waitlist = rsvps.filter(r => r.status === 'WAITLIST');

    const formatUsers = (users: typeof rsvps) => {
        if (users.length === 0) return 'None';
        return users.map(r => `<@${r.userId}>`).join(', ');
    };

    const embed = new EmbedBuilder()
        .setTitle(`👥 RSVPers for ${evt.title}`)
        .setColor('#5865F2')
        .addFields(
            { name: `✅ Going (${yes.length})`, value: formatUsers(yes), inline: false },
            { name: `🤔 Maybe (${maybe.length})`, value: formatUsers(maybe), inline: false },
            { name: `⏳ Waitlist (${waitlist.length})`, value: formatUsers(waitlist), inline: false }
        );

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleEventUnrsvp(interaction: ButtonInteraction): Promise<void> {
    const eventId = interaction.customId.split(':')[2];
    
    const evt = await eventService.getEventById(eventId);
    if (!evt) {
        await interaction.reply({ content: 'This event no longer exists.', ephemeral: true });
        return;
    }

    const removed = await eventService.removeRsvp(eventId, interaction.user.id);
    
    if (removed) {
        const member = interaction.member as GuildMember;
        if (evt.attendeeRoleId && member) {
            await member.roles.remove(evt.attendeeRoleId).catch((error) => {
                logger.warn(`Could not remove attendee role from ${interaction.user.id}:`, error);
            });
        }

        if (interaction.guild) {
            try {
                const { eventDiscordService } = await import('../../services/event-discord-service');
                if (eventDiscordService) {
                    await eventDiscordService.updateEventMessage(evt, interaction.guild);
                }
            } catch (error) {
                logger.warn('Could not update event Discord message:', error);
            }
        }
        
        await interaction.reply({ content: '✅ You have successfully un-RSVP\'d from this event.', ephemeral: true });
    } else {
        await interaction.reply({ content: 'You were not RSVP\'d to this event.', ephemeral: true });
    }
}

async function handleEventDelete(interaction: ButtonInteraction): Promise<void> {
    const eventId = interaction.customId.split(':')[2];
    
    const evt = await eventService.getEventById(eventId);
    if (!evt) {
        await interaction.reply({ content: 'This event no longer exists.', ephemeral: true });
        return;
    }

    const isAdminOrCreator = interaction.memberPermissions?.has('Administrator') || interaction.user.id === evt.creatorId;
    if (!isAdminOrCreator) {
        await interaction.reply({ content: 'You do not have permission to delete this event.', ephemeral: true });
        return;
    }

    try {
        const success = await eventService.deleteEvent(eventId);
        
        if (success) {
            await interaction.reply({ content: '✅ Event has been deleted.', ephemeral: true });
        } else {
            await interaction.reply({ content: '❌ Failed to delete event.', ephemeral: true });
        }
    } catch (error) {
        logger.error('Error deleting event from interaction:', error);
        await interaction.reply({ content: '❌ An error occurred while deleting the event.', ephemeral: true });
    }
}

export function registerEventComponentHandlers(router: ComponentRouter): void {
    router.register('button', 'event:rsvp:', handleEventRsvp, { moduleId: 'events' });
    router.register('button', 'event:reminder:', handleEventReminder, { moduleId: 'events' });
    router.register('button', 'event:details:', handleEventDetails, { moduleId: 'events' });
    router.register('button', 'event:settings:', handleEventSettings, { moduleId: 'events' });
    router.register('button', 'event_action:edit:', handleEventEdit, { moduleId: 'events' });
    router.register('button', 'event_action:rsvpers:', handleEventRsvpers, { moduleId: 'events' });
    router.register('button', 'event_action:unrsvp:', handleEventUnrsvp, { moduleId: 'events' });
    router.register('button', 'event_action:delete:', handleEventDelete, { moduleId: 'events' });
    router.register('button', 'reminder:preset:', handleReminderPreset, { moduleId: 'events' });
    router.register('button', 'reminder:custom:', handleCustomReminder, { moduleId: 'events' });
    router.register('button', 'dm_reminder:', handleDmReminder, { moduleId: 'events' });
    router.register('modal', 'reminder_modal:', handleReminderModalSubmit, { moduleId: 'events' });
}
