import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../database/client';
import {
    notificationDelivery,
    notificationEvent,
    notificationPreference,
} from '../database/schema';
import {
    type GuildNotificationEventType,
    type NotificationSeverity,
    type NotificationSource,
    isGuildNotificationEventType,
    meetsSeverityThreshold,
} from '../notifications/events';

interface NotificationMetadata {
    [key: string]: unknown;
}

export interface EmitGuildNotificationInput {
    guildId: string;
    eventType: GuildNotificationEventType;
    severity?: NotificationSeverity;
    source?: NotificationSource;
    title: string;
    body?: string | null;
    actorUserId?: string | null;
    targetUserId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    metadata?: NotificationMetadata;
    dedupeKey?: string | null;
    dedupeWindowSeconds?: number;
    occurredAt?: Date;
    expiresAt?: Date | null;
}

export async function emitGuildNotification(input: EmitGuildNotificationInput): Promise<string | null> {
    if (!input.guildId) {
        throw new Error('emitGuildNotification requires a guildId.');
    }

    if (!isGuildNotificationEventType(input.eventType)) {
        throw new Error(`Unsupported guild notification event type: ${input.eventType}`);
    }

    const severity = input.severity ?? 'INFO';
    const source = input.source ?? 'BOT_EVENT';
    const occurredAt = input.occurredAt ?? new Date();
    const dedupeWindowSeconds = Math.max(30, input.dedupeWindowSeconds ?? 300);

    const [preference] = await db.select()
        .from(notificationPreference)
        .where(and(
            eq(notificationPreference.guildId, input.guildId),
            eq(notificationPreference.eventType, input.eventType),
        ))
        .limit(1);

    if (preference && !preference.enabled) {
        return null;
    }

    if (preference && !meetsSeverityThreshold(severity, preference.minSeverity)) {
        return null;
    }

    const inAppVisible = preference?.inAppEnabled ?? true;
    const shouldQueueDiscordChannel = Boolean(preference?.discordChannelEnabled && preference.discordChannelId);
    const shouldQueueWebhook = Boolean(preference?.webhookEnabled && preference.webhookUrl);

    if (!inAppVisible && !shouldQueueDiscordChannel && !shouldQueueWebhook) {
        return null;
    }

    const dedupeKey = input.dedupeKey?.trim();
    if (dedupeKey) {
        const windowStart = new Date(occurredAt.getTime() - dedupeWindowSeconds * 1000);
        const [existing] = await db.select({
            id: notificationEvent.id,
        })
            .from(notificationEvent)
            .where(and(
                eq(notificationEvent.guildId, input.guildId),
                eq(notificationEvent.dedupeKey, dedupeKey),
                gte(notificationEvent.occurredAt, windowStart),
            ))
            .orderBy(desc(notificationEvent.occurredAt))
            .limit(1);

        if (existing) {
            await db.update(notificationEvent)
                .set({
                    title: input.title,
                    body: input.body ?? null,
                    severity,
                    source,
                    metadata: input.metadata,
                    occurrenceCount: sql`${notificationEvent.occurrenceCount} + 1`,
                    occurredAt,
                    updatedAt: new Date(),
                })
                .where(eq(notificationEvent.id, existing.id));

            return existing.id;
        }
    }

    const [created] = await db.insert(notificationEvent).values({
        guildId: input.guildId,
        eventType: input.eventType,
        severity,
        source,
        title: input.title,
        body: input.body ?? null,
        actorUserId: input.actorUserId ?? null,
        targetUserId: input.targetUserId ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: input.metadata,
        dedupeKey: dedupeKey ?? null,
        inAppVisible,
        occurredAt,
        expiresAt: input.expiresAt ?? null,
        updatedAt: new Date(),
    }).returning({
        id: notificationEvent.id,
    });

    const deliveries: Array<typeof notificationDelivery.$inferInsert> = [];
    if (shouldQueueDiscordChannel && preference?.discordChannelId) {
        deliveries.push({
            notificationId: created.id,
            guildId: input.guildId,
            channelType: 'DISCORD_CHANNEL',
            target: preference.discordChannelId,
            status: 'PENDING',
            nextAttemptAt: new Date(),
            updatedAt: new Date(),
        });
    }
    if (shouldQueueWebhook && preference?.webhookUrl) {
        deliveries.push({
            notificationId: created.id,
            guildId: input.guildId,
            channelType: 'WEBHOOK',
            target: preference.webhookUrl,
            status: 'PENDING',
            nextAttemptAt: new Date(),
            updatedAt: new Date(),
        });
    }

    if (deliveries.length > 0) {
        await db.insert(notificationDelivery).values(deliveries);
    }

    return created.id;
}

