import { eq } from 'drizzle-orm';
import { db } from '@shared/database/client';
import { event, eventPollSettings, type Event, type NewEvent } from '@shared/database/schema';
import { webhookService } from '../../bot/services/webhook-service';

export interface CreateEventData {
    guildId: string;
    creatorId: string;
    channelId: string;
    locationChannelId?: string;
    title: string;
    startTime: Date;
    description?: string;
    color?: string;
    endTime?: Date | null;
    durationMinutes?: number;
    location?: string;
    imageUrl?: string;
    maxAttendees?: number;
    enableWaitlist?: boolean;
    mentionRoleIds?: string[];
    mentionOnCreate?: boolean;
    mentionOnStart?: boolean;
    requiredRoleIds?: string[];
    blockedRoleIds?: string[];
    attendeeRoleId?: string;
    repeatFrequency?: 'NONE' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'YEARLY';
    repeatUntil?: Date;
    mirrorToDiscord?: boolean;
}

async function deleteDiscordMessage(channelId: string, messageId: string): Promise<void> {
    const token = process.env.DISCORD_TOKEN;
    if (!token) return;

    try {
        await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bot ${token}` },
        });
    } catch {
        // Best effort cleanup.
    }
}

async function deleteDiscordScheduledEvent(guildId: string, scheduledEventId: string): Promise<void> {
    const token = process.env.DISCORD_TOKEN;
    if (!token) return;

    try {
        await fetch(`https://discord.com/api/v10/guilds/${guildId}/scheduled-events/${scheduledEventId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bot ${token}` },
        });
    } catch {
        // Best effort cleanup.
    }
}

class EventDomainService {
    async createEvent(data: CreateEventData): Promise<Event> {
        let mirrorToDiscord = data.mirrorToDiscord;
        if (mirrorToDiscord === undefined) {
            const [settings] = await db
                .select()
                .from(eventPollSettings)
                .where(eq(eventPollSettings.guildId, data.guildId));
            mirrorToDiscord = settings?.mirrorToDiscordEvents ?? true;
        }

        const normalizedDurationMinutes = data.durationMinutes
            ?? (data.endTime
                ? Math.max(1, Math.round((data.endTime.getTime() - data.startTime.getTime()) / 60000))
                : 60);

        const eventData: NewEvent = {
            guildId: data.guildId,
            creatorId: data.creatorId,
            channelId: data.channelId,
            locationChannelId: data.locationChannelId,
            title: data.title,
            description: data.description,
            color: data.color,
            location: data.location,
            imageUrl: data.imageUrl,
            startTime: data.startTime,
            endTime: data.endTime,
            durationMinutes: normalizedDurationMinutes,
            maxAttendees: data.maxAttendees,
            enableWaitlist: data.enableWaitlist ?? false,
            mentionRoleIds: data.mentionRoleIds,
            mentionOnCreate: data.mentionOnCreate ?? false,
            mentionOnStart: data.mentionOnStart ?? false,
            requiredRoleIds: data.requiredRoleIds,
            blockedRoleIds: data.blockedRoleIds,
            attendeeRoleId: data.attendeeRoleId,
            repeatFrequency: data.repeatFrequency ?? 'NONE',
            repeatUntil: data.repeatUntil,
            mirrorToDiscord,
            status: 'SCHEDULED',
        };

        const [created] = await db.insert(event).values(eventData).returning();

        await webhookService.triggerEvent(data.guildId, 'event.created', {
            eventId: created.id,
            title: created.title,
            creatorId: created.creatorId,
            startTime: created.startTime,
            channelId: created.channelId,
            locationChannelId: created.locationChannelId,
            discordScheduledEventId: created.discordScheduledEventId,
        });

        return created;
    }

    async createRepeatingEvents(parentEvent: Event): Promise<Event[]> {
        if (parentEvent.repeatFrequency === 'NONE' || !parentEvent.repeatUntil) {
            return [];
        }

        const created: Event[] = [];
        let currentDate = new Date(parentEvent.startTime);
        const endDate = parentEvent.repeatUntil;

        while (currentDate < endDate) {
            switch (parentEvent.repeatFrequency) {
                case 'DAILY':
                    currentDate.setDate(currentDate.getDate() + 1);
                    break;
                case 'WEEKLY':
                    currentDate.setDate(currentDate.getDate() + 7);
                    break;
                case 'BIWEEKLY':
                    currentDate.setDate(currentDate.getDate() + 14);
                    break;
                case 'MONTHLY':
                    currentDate.setMonth(currentDate.getMonth() + 1);
                    break;
                case 'YEARLY':
                    currentDate.setFullYear(currentDate.getFullYear() + 1);
                    break;
            }

            if (currentDate >= endDate) break;

            const newEventData: NewEvent = {
                ...parentEvent,
                id: undefined as any,
                startTime: currentDate,
                endTime: parentEvent.endTime
                    ? new Date(currentDate.getTime() + (parentEvent.endTime.getTime() - parentEvent.startTime.getTime()))
                    : undefined,
                parentEventId: parentEvent.id,
                mirrorToDiscord: false,
                discordScheduledEventId: null,
                messageId: undefined,
                createdAt: undefined,
                updatedAt: undefined,
            };

            const [newEvent] = await db.insert(event).values(newEventData).returning();
            created.push(newEvent);
        }

        return created;
    }

    async getEventById(eventId: string): Promise<Event | undefined> {
        const [result] = await db.select().from(event).where(eq(event.id, eventId));
        return result;
    }

    async updateEvent(eventId: string, data: Partial<NewEvent>): Promise<Event | undefined> {
        const existing = await this.getEventById(eventId);
        if (!existing) return undefined;

        const [updated] = await db
            .update(event)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(event.id, eventId))
            .returning();

        if (!updated) return undefined;

        if (!updated.mirrorToDiscord && existing.mirrorToDiscord && existing.discordScheduledEventId) {
            await deleteDiscordScheduledEvent(existing.guildId, existing.discordScheduledEventId);
            await db
                .update(event)
                .set({ discordScheduledEventId: null })
                .where(eq(event.id, eventId));
            updated.discordScheduledEventId = null;
        }

        await webhookService.triggerEvent(updated.guildId, 'event.updated', {
            eventId: updated.id,
            title: updated.title,
            status: updated.status,
            startTime: updated.startTime,
            endTime: updated.endTime,
            channelId: updated.channelId,
            locationChannelId: updated.locationChannelId,
            mirrorToDiscord: updated.mirrorToDiscord,
            discordScheduledEventId: updated.discordScheduledEventId,
        });

        return updated;
    }

    async setEventMessageId(eventId: string, messageId: string): Promise<void> {
        await db.update(event).set({ messageId }).where(eq(event.id, eventId));
    }

    async setEventDiscordScheduledEventId(
        eventId: string,
        discordScheduledEventId: string | null
    ): Promise<void> {
        await db
            .update(event)
            .set({
                discordScheduledEventId,
                updatedAt: new Date(),
            })
            .where(eq(event.id, eventId));
    }

    async setEventStatus(eventId: string, status: Event['status']): Promise<Event | undefined> {
        const [updated] = await db
            .update(event)
            .set({
                status,
                updatedAt: new Date(),
            })
            .where(eq(event.id, eventId))
            .returning();

        return updated;
    }

    async disableEventMirror(eventId: string): Promise<void> {
        await db
            .update(event)
            .set({
                mirrorToDiscord: false,
                discordScheduledEventId: null,
                updatedAt: new Date(),
            })
            .where(eq(event.id, eventId));
    }

    async deleteEvent(eventId: string): Promise<boolean> {
        const eventData = await this.getEventById(eventId);
        if (!eventData) return false;

        if (eventData.channelId && eventData.messageId) {
            await deleteDiscordMessage(eventData.channelId, eventData.messageId);
        }
        if (eventData.mirrorToDiscord && eventData.discordScheduledEventId) {
            await deleteDiscordScheduledEvent(eventData.guildId, eventData.discordScheduledEventId);
        }

        await webhookService.triggerEvent(eventData.guildId, 'event.deleted', {
            eventId: eventData.id,
            title: eventData.title,
            status: eventData.status,
            startTime: eventData.startTime,
            channelId: eventData.channelId,
            discordScheduledEventId: eventData.discordScheduledEventId,
        });

        const result = await db.delete(event).where(eq(event.id, eventId));
        return (result.rowCount ?? 0) > 0;
    }
}

export const eventService = new EventDomainService();
