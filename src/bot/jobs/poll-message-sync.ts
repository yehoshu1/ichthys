import { Client } from 'discord.js';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { db } from '@shared/database/client';
import { poll } from '@shared/database/schema';
import { isModuleEnabled } from '@shared/modules/state';
import { pollDiscordService } from '../services/poll-discord-service';
import logger from '../utils/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// POLL MESSAGE SYNC JOB
// Creates Discord messages for polls that don't have one yet
// Also updates edited polls and handles closing polls
// ═══════════════════════════════════════════════════════════════════════════════

export class PollMessageSyncJob {
    private client: Client;
    private intervalId: NodeJS.Timeout | null = null;
    private readonly intervalMs = 5000; // Check every 5 seconds
    private readonly createSyncGraceMs = 15000; // Let command-path posting set messageId first

    constructor(client: Client) {
        this.client = client;
    }

    start(): void {
        logger.info('Starting poll message sync job');
        this.intervalId = setInterval(() => this.sync(), this.intervalMs);
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger.info('Stopped poll message sync job');
        }
    }

    private async sync(): Promise<void> {
        try {
            await this.syncNewPolls();
            await this.syncUpdatedPolls();
            await this.syncRecentlyClosedPolls();
            await this.syncClosingPolls();
        } catch (error) {
            logger.error('Error in poll message sync:', error);
        }
    }

    private async syncNewPolls(): Promise<void> {
        const createdBefore = new Date(Date.now() - this.createSyncGraceMs);

        // Find polls without messageId (newly created polls)
        const newPolls = await db
            .select()
            .from(poll)
            .where(and(
                isNull(poll.messageId),
                eq(poll.closed, false),
                sql`${poll.createdAt} <= ${createdBefore}`
            ))
            .limit(10);

        if (newPolls.length === 0) return;

        logger.info(`Found ${newPolls.length} new polls to create Discord messages for`);

        for (const p of newPolls) {
            try {
                const pollsEnabled = await isModuleEnabled(p.guildId, 'polls');
                if (!pollsEnabled) {
                    continue;
                }

                const guild = await this.client.guilds.fetch(p.guildId).catch(() => null);
                if (!guild) {
                    logger.warn(`Guild ${p.guildId} not found for poll ${p.id}`);
                    continue;
                }

                await pollDiscordService.createPollMessage(p, guild);
                logger.info(`Created Discord message for poll ${p.id}`);
            } catch (error) {
                logger.error(`Failed to create Discord message for poll ${p.id}:`, error);
            }
        }
    }

    private async syncUpdatedPolls(): Promise<void> {
        // Find polls that were updated in the last 10 seconds and have a messageId
        // This handles edits from the dashboard
        const tenSecondsAgo = new Date(Date.now() - 10000);
        
        const updatedPolls = await db
            .select()
            .from(poll)
            .where(and(
                sql`${poll.messageId} IS NOT NULL`,
                sql`${poll.updatedAt} > ${tenSecondsAgo}`,
                eq(poll.closed, false)
            ))
            .limit(10);

        if (updatedPolls.length === 0) return;

        for (const p of updatedPolls) {
            try {
                const pollsEnabled = await isModuleEnabled(p.guildId, 'polls');
                if (!pollsEnabled) {
                    continue;
                }

                const guild = await this.client.guilds.fetch(p.guildId).catch(() => null);
                if (!guild) continue;

                await pollDiscordService.updatePollMessage(p, guild);
                logger.info(`Updated Discord message for edited poll ${p.id}`);
            } catch (error) {
                logger.error(`Failed to update Discord message for poll ${p.id}:`, error);
            }
        }
    }

    private async syncClosingPolls(): Promise<void> {
        // Find polls that have endTime passed and are not closed yet
        const now = new Date();
        
        const closingPolls = await db
            .select()
            .from(poll)
            .where(and(
                sql`${poll.endTime} IS NOT NULL`,
                sql`${poll.endTime} <= ${now}`,
                eq(poll.closed, false),
                sql`${poll.messageId} IS NOT NULL`
            ))
            .limit(10);

        if (closingPolls.length === 0) return;

        for (const p of closingPolls) {
            try {
                const pollsEnabled = await isModuleEnabled(p.guildId, 'polls');
                if (!pollsEnabled) {
                    continue;
                }

                // Close the poll
                await import('../services/poll-service').then(m => m.pollService.closePoll(p.id));
                
                // Update the Discord message
                const guild = await this.client.guilds.fetch(p.guildId).catch(() => null);
                if (!guild) continue;

                await pollDiscordService.updatePollMessage({ ...p, closed: true }, guild);
                logger.info(`Auto-closed poll ${p.id} due to end time`);
            } catch (error) {
                logger.error(`Failed to auto-close poll ${p.id}:`, error);
            }
        }
    }

    private async syncRecentlyClosedPolls(): Promise<void> {
        const tenSecondsAgo = new Date(Date.now() - 10000);

        const recentlyClosedPolls = await db
            .select()
            .from(poll)
            .where(and(
                sql`${poll.messageId} IS NOT NULL`,
                sql`${poll.updatedAt} > ${tenSecondsAgo}`,
                eq(poll.closed, true)
            ))
            .limit(10);

        if (recentlyClosedPolls.length === 0) return;

        for (const p of recentlyClosedPolls) {
            try {
                const pollsEnabled = await isModuleEnabled(p.guildId, 'polls');
                if (!pollsEnabled) {
                    continue;
                }

                const guild = await this.client.guilds.fetch(p.guildId).catch(() => null);
                if (!guild) continue;

                await pollDiscordService.updatePollMessage(p, guild);
                logger.info(`Synced recently closed poll message ${p.id}`);
            } catch (error) {
                logger.error(`Failed to sync closed poll message ${p.id}:`, error);
            }
        }
    }
}

export function startPollMessageSync(client: Client): PollMessageSyncJob {
    const job = new PollMessageSyncJob(client);
    job.start();
    return job;
}
