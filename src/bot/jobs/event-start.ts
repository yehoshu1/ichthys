import { Client, EmbedBuilder, TextChannel } from 'discord.js';
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

                // Get channel
                const channel = guild.channels.cache.get(evt.channelId) as TextChannel;
                if (!channel || !channel.isTextBased()) {
                    logger.warn(`Channel ${evt.channelId} not found for starting event ${evt.id}`);
                    continue;
                }

                // Get attendees
                const rsvps = await eventService.getRsvpsByEvent(evt.id, 'YES');
                const attendeeIds = rsvps.map(r => r.userId);

                // Build start announcement
                const embed = new EmbedBuilder()
                    .setTitle('🎉 Event Starting Now!')
                    .setDescription(`**${evt.title}** is starting!`)
                    .setColor('#57F287')
                    .addFields(
                        { name: 'Event', value: evt.title, inline: false },
                        { name: 'Started', value: formatDiscordTimestamp(evt.startTime, 'R'), inline: false }
                    );

                if (evt.location) {
                    embed.addFields({ name: 'Location', value: evt.location, inline: false });
                }

                if (attendeeIds.length > 0) {
                    const mentions = attendeeIds.map(id => `<@${id}>`).join(' ');
                    
                    // Send mention message if configured
                    if (evt.mentionOnStart && evt.mentionRoleIds?.length) {
                        const roleMentions = evt.mentionRoleIds.map(id => `<@&${id}>`).join(' ');
                        await channel.send({
                            content: `${roleMentions}\n🎉 **${evt.title}** is starting now!`,
                            allowedMentions: { roles: evt.mentionRoleIds },
                        });
                    } else {
                        await channel.send({
                            content: `🎉 **${evt.title}** is starting now!`,
                        });
                    }

                    // Send attendee mentions
                    if (mentions.length <= 2000) {
                        await channel.send({
                            content: `Attendees: ${mentions}`,
                            allowedMentions: { users: attendeeIds },
                        });
                    }
                }

                await channel.send({ embeds: [embed] });

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

                logger.info(`Event ${evt.id} "${evt.title}" started in ${guild.name}`);

            } catch (error) {
                logger.error(`Error handling start of event ${evt.id}:`, error);
            }
        }

    } catch (error) {
        logger.error('Error in event start job:', error);
    }
}
