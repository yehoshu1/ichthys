import { Client, EmbedBuilder } from 'discord.js';
import { eventService } from '../services/event-service';
import { formatDiscordTimestamp } from '../utils/date-parser';
import logger from '../utils/logger';
import { isModuleEnabled } from '@shared/modules/state';

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT REMINDER JOB
// ═══════════════════════════════════════════════════════════════════════════════

export const name = 'event-reminders';
export const schedule = '*/1 * * * *'; // Run every minute

export async function execute(client: Client) {
    try {
        // Look for reminders that should be sent in the next minute
        const now = new Date();
        const oneMinuteFromNow = new Date(now.getTime() + 60000);

        const pendingReminders = await eventService.getPendingReminders(oneMinuteFromNow);

        for (const { reminder, event: evt } of pendingReminders) {
            try {
                const eventsEnabled = await isModuleEnabled(evt.guildId, 'events');
                if (!eventsEnabled) {
                    await eventService.markReminderSent(reminder.id);
                    continue;
                }

                // Get the user
                const user = await client.users.fetch(reminder.userId);
                if (!user) {
                    await eventService.markReminderSent(reminder.id);
                    continue;
                }

                // Build reminder embed
                const embed = new EmbedBuilder()
                    .setTitle('⏰ Event Reminder')
                    .setColor('#5865F2')
                    .setDescription(`**${evt.title}** is starting soon!`)
                    .addFields(
                        { name: 'Event', value: evt.title, inline: false },
                        { name: 'Starts', value: formatDiscordTimestamp(evt.startTime, 'R'), inline: false },
                        {
                            name: 'Location',
                            value: evt.locationChannelId
                                ? `<#${evt.locationChannelId}>${evt.location ? `\n${evt.location}` : ''}`
                                : (evt.location || `<#${evt.channelId}>`),
                            inline: false,
                        }
                    );

                if (evt.description) {
                    embed.addFields({ name: 'Description', value: evt.description.substring(0, 200), inline: false });
                }

                // Send DM
                await user.send({ embeds: [embed] });

                // Mark reminder as sent
                await eventService.markReminderSent(reminder.id);

                logger.info(`Sent reminder to ${reminder.userId} for event ${evt.id}`);

            } catch (error) {
                // Failed to send DM, mark as sent anyway to avoid retrying
                await eventService.markReminderSent(reminder.id);
                logger.warn(`Failed to send reminder to ${reminder.userId}:`, error);
            }
        }

    } catch (error) {
        logger.error('Error in event reminders job:', error);
    }
}
