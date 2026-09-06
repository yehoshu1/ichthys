import { Client } from 'discord.js';
import { eq, and, isNull, lt, sql } from 'drizzle-orm';
import { db } from '@shared/database/client';
import { event } from '@shared/database/schema';
import { isModuleEnabled } from '@shared/modules/state';
import { eventService as eventDomainService } from '@shared/services/event-domain-service';
import { eventDiscordService } from '../services/event-discord-service';
import { eventService } from '../services/event-service';
import logger from '../utils/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT MESSAGE SYNC JOB
// Creates Discord messages for events that don't have one yet
// Also updates edited events
// ═══════════════════════════════════════════════════════════════════════════════

export class EventMessageSyncJob {
    private client: Client;
    private intervalId: NodeJS.Timeout | null = null;
    private readonly intervalMs = 5000; // Check every 5 seconds

    constructor(client: Client) {
        this.client = client;
    }

    start(): void {
        logger.info('Starting event message sync job');
        this.intervalId = setInterval(() => this.sync(), this.intervalMs);
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger.info('Stopped event message sync job');
        }
    }

    private async sync(): Promise<void> {
        try {
            await this.syncNewEvents();
            await this.syncUpdatedEvents();
        } catch (error) {
            logger.error('Error in event message sync:', error);
        }
    }

    private async syncNewEvents(): Promise<void> {
        // Find events without messageId that were created at least 15 seconds ago.
        // The 15-second buffer ensures the /event create command (which posts the
        // message inline) has already stored the messageId before we attempt a
        // fallback post here, preventing duplicate Discord messages.
        const fifteenSecondsAgo = new Date(Date.now() - 15000);
        const newEvents = await db
            .select()
            .from(event)
            .where(and(
                isNull(event.messageId),
                eq(event.status, 'SCHEDULED'),
                lt(event.createdAt, fifteenSecondsAgo)
            ))
            .limit(10);

        if (newEvents.length === 0) return;

        logger.info(`Found ${newEvents.length} new events to create Discord messages for`);

        for (const evt of newEvents) {
            try {
                const eventsEnabled = await isModuleEnabled(evt.guildId, 'events');
                if (!eventsEnabled) {
                    continue;
                }

                const guild = await this.client.guilds.fetch(evt.guildId).catch(() => null);
                if (!guild) {
                    logger.warn(`Guild ${evt.guildId} not found for event ${evt.id}`);
                    continue;
                }

                // Create Discord message
                await eventDiscordService.createEventMessage(evt, guild);
                logger.info(`Created Discord message for event ${evt.id}`);

                // Create Discord Scheduled Event if enabled and not already created
                if (evt.mirrorToDiscord && !evt.discordScheduledEventId) {
                    try {
                        await eventService.syncEventWithDiscord(evt.id, guild);
                        logger.info(`Created Discord Scheduled Event for event ${evt.id}`);
                    } catch (discordError) {
                        logger.error(`Failed to create Discord Scheduled Event for event ${evt.id}:`, discordError);
                    }
                }
            } catch (error) {
                logger.error(`Failed to create Discord message for event ${evt.id}:`, error);
            }
        }
    }

    private async syncUpdatedEvents(): Promise<void> {
        // Find events that were updated in the last 10 seconds and have a messageId
        // This handles edits from the dashboard
        const tenSecondsAgo = new Date(Date.now() - 10000);
        
        const updatedEvents = await db
            .select()
            .from(event)
            .where(and(
                sql`${event.messageId} IS NOT NULL`,
                sql`${event.updatedAt} > ${tenSecondsAgo}`
            ))
            .limit(10);

        if (updatedEvents.length === 0) return;

        for (const evt of updatedEvents) {
            try {
                const eventsEnabled = await isModuleEnabled(evt.guildId, 'events');
                if (!eventsEnabled) {
                    continue;
                }

                const guild = await this.client.guilds.fetch(evt.guildId).catch(() => null);
                if (!guild) continue;

                // Update Discord message
                await eventDiscordService.updateEventMessage(evt, guild);
                logger.info(`Updated Discord message for edited event ${evt.id}`);

                // Sync Discord Scheduled Event if enabled
                if (evt.mirrorToDiscord) {
                    try {
                        await eventService.syncEventWithDiscord(evt.id, guild);
                        logger.info(`Synced Discord Scheduled Event for event ${evt.id}`);
                    } catch (discordError) {
                        logger.error(`Failed to sync Discord Scheduled Event for event ${evt.id}:`, discordError);
                    }
                } else if (evt.discordScheduledEventId) {
                    try {
                        await eventService.deleteDiscordScheduledEvent(evt, guild);
                        await eventDomainService.setEventDiscordScheduledEventId(evt.id, null);
                        logger.info(`Removed Discord Scheduled Event for event ${evt.id} (mirroring disabled)`);
                    } catch (discordError) {
                        logger.error(`Failed to remove Discord Scheduled Event for event ${evt.id}:`, discordError);
                    }
                }
            } catch (error) {
                logger.error(`Failed to update Discord message for event ${evt.id}:`, error);
            }
        }
    }
}

export function startEventMessageSync(client: Client): EventMessageSyncJob {
    const job = new EventMessageSyncJob(client);
    job.start();
    return job;
}
