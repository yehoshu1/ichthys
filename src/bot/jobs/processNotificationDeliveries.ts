import cron from 'node-cron';
import { and, asc, eq, lte } from 'drizzle-orm';
import { TextChannel } from 'discord.js';
import client from '../client';
import logger from '../utils/logger';
import { db } from '../../shared/database/client';
import { notificationDelivery, notificationEvent } from '../../shared/database/schema';
import { isModuleEnabled } from '@shared/modules/state';

const MAX_PER_RUN = 50;
const MAX_ATTEMPTS = 5;
let isRunning = false;
let schemaUnavailable = false;

function isMissingNotificationSchemaError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }

    const maybeCode = (error as { code?: string }).code;
    if (maybeCode === '42P01') {
        return true;
    }

    const message = error.message.toLowerCase();
    return message.includes('relation "notification_delivery" does not exist')
        || message.includes('relation "notification_event" does not exist');
}

function buildDeliveryMessage(event: Pick<typeof notificationEvent.$inferSelect, 'severity' | 'title' | 'body'>): string {
    const header = `[${event.severity}] ${event.title}`;
    const body = event.body?.trim();
    const message = body ? `${header}\n${body}` : header;
    return message.length > 2000 ? `${message.slice(0, 1997)}...` : message;
}

function getBackoffSeconds(attempt: number): number {
    const clamped = Math.max(1, Math.min(attempt, 8));
    return clamped * clamped * 30;
}

async function markDeliverySuccess(deliveryId: string, attempts: number): Promise<void> {
    await db.update(notificationDelivery)
        .set({
            status: 'SENT',
            attempts,
            sentAt: new Date(),
            lastError: null,
            updatedAt: new Date(),
        })
        .where(eq(notificationDelivery.id, deliveryId));
}

async function markDeliveryFailure(deliveryId: string, attempts: number, errorMessage: string): Promise<void> {
    if (attempts >= MAX_ATTEMPTS) {
        await db.update(notificationDelivery)
            .set({
                status: 'FAILED',
                attempts,
                lastError: errorMessage,
                updatedAt: new Date(),
            })
            .where(eq(notificationDelivery.id, deliveryId));
        return;
    }

    const nextAttemptAt = new Date(Date.now() + getBackoffSeconds(attempts) * 1000);
    await db.update(notificationDelivery)
        .set({
            status: 'PENDING',
            attempts,
            nextAttemptAt,
            lastError: errorMessage,
            updatedAt: new Date(),
        })
        .where(eq(notificationDelivery.id, deliveryId));
}

async function processDelivery(
    delivery: typeof notificationDelivery.$inferSelect,
    event: typeof notificationEvent.$inferSelect
): Promise<void> {
    const attempts = delivery.attempts + 1;
    const content = buildDeliveryMessage(event);

    try {
        if (delivery.channelType === 'DISCORD_CHANNEL') {
            const guild = await client.guilds.fetch(delivery.guildId).catch((error) => { logger.warn(`Failed to fetch guild ${delivery.guildId} for notification delivery:`, error); return null; });
            if (!guild) {
                throw new Error(`Guild ${delivery.guildId} unavailable`);
            }

            const channel = await guild.channels.fetch(delivery.target).catch((error) => { logger.warn(`Failed to fetch channel ${delivery.target} for notification delivery:`, error); return null; });
            if (!channel || !channel.isTextBased()) {
                throw new Error(`Channel ${delivery.target} not found or not text-based`);
            }

            await (channel as TextChannel).send({ content });
            await markDeliverySuccess(delivery.id, attempts);
            return;
        }

        if (delivery.channelType === 'WEBHOOK') {
            const response = await fetch(delivery.target, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content }),
            });

            if (!response.ok) {
                throw new Error(`Webhook delivery failed with status ${response.status}`);
            }

            await markDeliverySuccess(delivery.id, attempts);
            return;
        }

        await db.update(notificationDelivery)
            .set({
                status: 'SKIPPED',
                attempts,
                lastError: `Unsupported channel type ${delivery.channelType}`,
                updatedAt: new Date(),
            })
            .where(eq(notificationDelivery.id, delivery.id));
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Delivery failed';
        logger.warn(`Notification delivery ${delivery.id} failed: ${message}`);
        await markDeliveryFailure(delivery.id, attempts, message);
    }
}

export async function processNotificationDeliveriesOnce(): Promise<void> {
    if (schemaUnavailable) {
        return;
    }

    const now = new Date();
    let pending: Array<{
        delivery: typeof notificationDelivery.$inferSelect;
        event: typeof notificationEvent.$inferSelect;
    }>;

    try {
        pending = await db.select({
            delivery: notificationDelivery,
            event: notificationEvent,
        })
            .from(notificationDelivery)
            .innerJoin(notificationEvent, eq(notificationDelivery.notificationId, notificationEvent.id))
            .where(and(
                eq(notificationDelivery.status, 'PENDING'),
                lte(notificationDelivery.nextAttemptAt, now),
            ))
            .orderBy(asc(notificationDelivery.nextAttemptAt))
            .limit(MAX_PER_RUN);
    } catch (error) {
        if (isMissingNotificationSchemaError(error)) {
            schemaUnavailable = true;
            logger.warn('Notification delivery is disabled because notification tables are missing. Run database migration and restart the bot.');
            return;
        }

        throw error;
    }

    if (pending.length === 0) {
        return;
    }

    logger.info(`Processing ${pending.length} queued notification delivery(ies)`);
    const moduleEnabledCache = new Map<string, boolean>();

    for (const row of pending) {
        let notificationsEnabled = moduleEnabledCache.get(row.delivery.guildId);
        if (notificationsEnabled === undefined) {
            notificationsEnabled = await isModuleEnabled(row.delivery.guildId, 'notifications');
            moduleEnabledCache.set(row.delivery.guildId, notificationsEnabled);
        }

        if (!notificationsEnabled) {
            continue;
        }

        await processDelivery(row.delivery, row.event);
    }
}

export function setupNotificationDeliveryJob(): void {
    cron.schedule('* * * * *', async () => {
        if (isRunning) {
            return;
        }

        isRunning = true;
        try {
            await processNotificationDeliveriesOnce();
        } catch (error) {
            logger.error('Notification delivery job failed:', error);
        } finally {
            isRunning = false;
        }
    });
}
