import { Client, EmbedBuilder } from 'discord.js';
import { eventService } from '../services/event-service';
import { formatDiscordTimestamp } from '../utils/date-parser';
import logger from '../utils/logger';
import { isModuleEnabled } from '@shared/modules/state';

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT START JOB
// ═══════════════════════════════════════════════════════════════════════════════

export const name = 'event-start';
export const schedule = '*/1 * * * *'; // Run every minute

export async function execute(client: Client) {
    try {
        const now = new Date();
        const oneMinuteFromNow = new Date(now.getTime() + 60000);

        // Find events starting in the next minute
        const startingEvents = await eventService.getEventsStartingBetween(now, oneMinuteFromNow);

        for (const evt of startingEvents) {
            try {
                const eventsEnabled = await isModuleEnabled(evt.guildId, 'events');
                if (!eventsEnabled) {
                    continue;
                }

                // Mark event as active
                await eventService.markEventAsStarted(evt.id);

                // Get guild
                const guild = client.guilds.cache.get(evt.guildId);
                if (!guild) {
                    logger.warn(`Guild ${evt.guildId} not found for starting event ${evt.id}`);
                    continue;
                }

                // Get channel (fallback to API fetch if not cached)
                const cachedChannel = guild.channels.cache.get(evt.channelId);
                const channel = cachedChannel ?? await guild.channels.fetch(evt.channelId).catch(() => null);

                if (!channel || !channel.isTextBased() || !('send' in channel)) {
                    logger.warn(`Channel ${evt.channelId} not found for starting event ${evt.id}`);
                    continue;
                }

                // Get attendees
                const rsvpsYes = await eventService.getRsvpsByEvent(evt.id, 'YES');
                const rsvpsMaybe = await eventService.getRsvpsByEvent(evt.id, 'MAYBE');
                
                const attendeeIds = rsvpsYes.map(r => r.userId);
                const dmRecipientIds = [...attendeeIds, ...rsvpsMaybe.map(r => r.userId)];

                // Build start announcement
                const embed = new EmbedBuilder()
                    .setTitle('🎉 Event Starting Now!')
                    .setDescription(`${evt.title} is starting!`)
                    .setColor('#57F287')
                    .addFields(
                        { name: 'Event', value: evt.title, inline: false },
                        { name: 'Started', value: formatDiscordTimestamp(evt.startTime, 'R'), inline: false }
                    );

                if (evt.location) {
                    embed.addFields({ name: 'Location', value: evt.location, inline: false });
                }

                embed.addFields({
                    name: `Attendees (${attendeeIds.length})`,
                    value: buildAttendeeFieldValue(attendeeIds),
                    inline: false,
                });

                const uniqueRoleIds = evt.mentionOnStart && evt.mentionRoleIds?.length
                    ? [...new Set(evt.mentionRoleIds)]
                    : [];
                const startMentions = uniqueRoleIds.length
                    ? uniqueRoleIds.map(id => `<@&${id}>`).join(' ')
                    : undefined;

                await channel.send({
                    content: startMentions,
                    embeds: [embed],
                    allowedMentions: uniqueRoleIds.length
                        ? { roles: uniqueRoleIds }
                        : undefined,
                });

                // Assign attendee roles if configured
                if (evt.attendeeRoleId) {
                    for (const userId of attendeeIds) {
                        try {
                            const member = await guild.members.fetch(userId);
                            if (member) {
                                await member.roles.add(evt.attendeeRoleId);
                            }
                        } catch (error) {
                            logger.warn(`Could not assign attendee role to ${userId}:`, error);
                        }
                    }
                }

                // Send DM to all attendees and maybes
                for (const userId of dmRecipientIds) {
                    try {
                        const user = await client.users.fetch(userId);
                        if (user) {
                            const dmEmbed = new EmbedBuilder()
                                .setTitle('🎉 Event Starting Now!')
                                .setDescription(`The event **${evt.title}** in **${guild.name}** is starting right now!`)
                                .setColor('#57F287')
                                .addFields(
                                    { name: 'Channel', value: `<#${evt.channelId}>`, inline: true }
                                );

                            if (evt.location) {
                                dmEmbed.addFields({ name: 'Location', value: evt.location, inline: true });
                            }

                            await user.send({ embeds: [dmEmbed] });
                        }
                    } catch (error) {
                        logger.warn(`Could not send start DM to attendee ${userId} for event ${evt.id}:`, error);
                    }
                }

                logger.info(`Event ${evt.id} "${evt.title}" started in ${guild.name}`);

            } catch (error) {
                logger.error(`Error handling start of event ${evt.id}:`, error);
            }
        }

    } catch (error) {
        logger.error('Error in event start job:', error);
    }
}

function buildAttendeeFieldValue(attendeeIds: string[]): string {
    if (attendeeIds.length === 0) {
        return 'No confirmed attendees yet.';
    }

    const maxFieldLength = 1024;
    const mentions: string[] = [];
    let currentLength = 0;

    for (const userId of attendeeIds) {
        const mention = `<@${userId}>`;
        const separatorLength = mentions.length > 0 ? 2 : 0; // ", "

        if (currentLength + separatorLength + mention.length > maxFieldLength) {
            break;
        }

        if (separatorLength > 0) {
            currentLength += separatorLength;
        }
        mentions.push(mention);
        currentLength += mention.length;
    }

    const omittedCount = attendeeIds.length - mentions.length;
    const suffix = omittedCount > 0 ? `, +${omittedCount} more` : '';
    return `${mentions.join(', ')}${suffix}`;
}
