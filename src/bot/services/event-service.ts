import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';
import { db } from '@shared/database/client';
import { eventService as eventDomainService } from '@shared/services/event-domain-service';
import { webhookService } from './webhook-service';
import {
    ChannelType,
    Guild,
    GuildScheduledEventEntityType,
    GuildScheduledEventPrivacyLevel,
    GuildScheduledEventRecurrenceRuleFrequency,
    GuildScheduledEventRecurrenceRuleOptions,
    GuildScheduledEventRecurrenceRuleWeekday,
} from 'discord.js';
import logger from '../utils/logger';
import {
    event,
    eventRsvp,
    eventReminder,
    eventTemplate,
    userTimezone,
    Event,
    EventRsvp,
    EventReminder,
    EventTemplate,
    NewEvent,
    NewEventRsvp,
    NewEventReminder,
    NewEventTemplate,
} from '@shared/database/schema';

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

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

export interface RsvpData {
    eventId: string;
    userId: string;
    status: 'YES' | 'NO' | 'MAYBE';
    note?: string;
}

export interface ReminderUpsertResult {
    status: 'created' | 'updated' | 'unchanged';
    previousMinutesBefore?: number;
}

export class EventService {


    // ═══════════════════════════════════════════════════════════════════════════════
    // EVENT CRUD
    // ═══════════════════════════════════════════════════════════════════════════════

    async createEvent(data: CreateEventData, guild?: Guild): Promise<Event> {
        const created = await eventDomainService.createEvent(data);

        // Create Discord Scheduled Event if enabled and guild provided
        if (created.mirrorToDiscord && guild) {
            try {
                const discordEventId = await this.createDiscordScheduledEvent(created, guild);
                if (discordEventId) {
                    await eventDomainService.setEventDiscordScheduledEventId(created.id, discordEventId);
                    created.discordScheduledEventId = discordEventId;
                }
            } catch (error) {
                logger.error('Failed to create Discord Scheduled Event:', error);
            }
        }

        return created;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // DISCORD SCHEDULED EVENTS
    // ═══════════════════════════════════════════════════════════════════════════════

    private async createDiscordScheduledEvent(eventData: Event, guild: Guild): Promise<string | null> {
        try {
            const locationConfig = await this.resolveScheduledEventLocationConfig(eventData, guild);
            const scheduledEndTime = this.resolveScheduledEndTime(eventData, locationConfig.entityType);
            const recurrenceRule = this.buildDiscordRecurrenceRule(eventData);

            const discordEvent = await guild.scheduledEvents.create({
                name: eventData.title,
                description: eventData.description || undefined,
                scheduledStartTime: eventData.startTime,
                scheduledEndTime,
                privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
                entityType: locationConfig.entityType,
                channel: locationConfig.channelId,
                entityMetadata: locationConfig.entityMetadata,
                image: eventData.imageUrl || undefined,
                recurrenceRule: recurrenceRule ?? undefined,
            });

            logger.info(`Created Discord Scheduled Event ${discordEvent.id} for event ${eventData.id}`);
            return discordEvent.id;
        } catch (error) {
            logger.error('Error creating Discord Scheduled Event:', error);
            return null;
        }
    }

    async updateDiscordScheduledEvent(eventData: Event, guild: Guild): Promise<void> {
        if (!eventData.discordScheduledEventId) return;

        try {
            const discordEvent = await guild.scheduledEvents.fetch(eventData.discordScheduledEventId).catch(() => null);
            if (!discordEvent) {
                logger.warn(`Discord Scheduled Event ${eventData.discordScheduledEventId} not found for event ${eventData.id}`);
                return;
            }

            // Update the event
            const locationConfig = await this.resolveScheduledEventLocationConfig(eventData, guild);
            const scheduledEndTime = this.resolveScheduledEndTime(eventData, locationConfig.entityType);
            const recurrenceRule = this.buildDiscordRecurrenceRule(eventData);
            await discordEvent.edit({
                name: eventData.title,
                description: eventData.description || undefined,
                scheduledStartTime: eventData.startTime,
                scheduledEndTime,
                entityType: locationConfig.entityType,
                channel: locationConfig.channelId ?? null,
                entityMetadata: locationConfig.entityMetadata,
                image: eventData.imageUrl || undefined,
                recurrenceRule: recurrenceRule ?? null,
                status: eventData.status === 'CANCELLED' ? 2 : undefined, // 2 = Canceled
            });

            logger.info(`Updated Discord Scheduled Event ${discordEvent.id} for event ${eventData.id}`);
        } catch (error) {
            logger.error('Error updating Discord Scheduled Event:', error);
        }
    }

    async deleteDiscordScheduledEvent(eventData: Event, guild: Guild): Promise<void> {
        if (!eventData.discordScheduledEventId) return;

        try {
            const discordEvent = await guild.scheduledEvents.fetch(eventData.discordScheduledEventId).catch(() => null);
            if (discordEvent) {
                await discordEvent.delete();
                logger.info(`Deleted Discord Scheduled Event ${discordEvent.id} for event ${eventData.id}`);
            }
        } catch (error) {
            logger.error('Error deleting Discord Scheduled Event:', error);
        }
    }

    async getEventById(eventId: string): Promise<Event | undefined> {
        const [result] = await db.select().from(event).where(eq(event.id, eventId));
        return result;
    }

    async getEventsByGuild(guildId: string, options?: {
        status?: string;
        upcoming?: boolean;
        limit?: number;
        offset?: number;
    }): Promise<Event[]> {
        const conditions = [eq(event.guildId, guildId)];

        if (options?.status) {
            conditions.push(eq(event.status, options.status as any));
        }

        if (options?.upcoming) {
            conditions.push(gte(event.startTime, new Date()));
            conditions.push(eq(event.status, 'SCHEDULED'));
        }

        const baseQuery = db.select().from(event).where(and(...conditions));

        // Apply ordering
        const orderedQuery = baseQuery.orderBy(asc(event.startTime));

        // Apply limit if specified
        if (options?.limit) {
            if (options?.offset) {
                return await orderedQuery.limit(options.limit).offset(options.offset);
            }
            return await orderedQuery.limit(options.limit);
        }

        return await orderedQuery;
    }

    async updateEvent(eventId: string, data: Partial<NewEvent>, guild?: Guild): Promise<Event | undefined> {
        const updated = await eventDomainService.updateEvent(eventId, data);
        if (!updated) return undefined;

        // Shared domain service handles webhook + mirror disable cleanup.
        // Bot-side service keeps native Discord scheduled events in sync when guild is available.
        if (updated.mirrorToDiscord && guild) {
            if (updated.discordScheduledEventId) {
                await this.updateDiscordScheduledEvent(updated, guild);
            } else {
                const discordEventId = await this.createDiscordScheduledEvent(updated, guild);
                if (discordEventId) {
                    await eventDomainService.setEventDiscordScheduledEventId(eventId, discordEventId);
                    updated.discordScheduledEventId = discordEventId;
                }
            }
        }

        return updated;
    }

    async deleteEvent(eventId: string, _guild?: Guild): Promise<boolean> {
        return eventDomainService.deleteEvent(eventId);
    }

    async cancelEvent(eventId: string, guild?: Guild): Promise<Event | undefined> {
        const updated = await this.updateEvent(eventId, { status: 'CANCELLED' }, guild);
        return updated;
    }

    async syncEventWithDiscord(eventId: string, guild: Guild): Promise<void> {
        const eventData = await this.getEventById(eventId);
        if (!eventData || !eventData.mirrorToDiscord) return;

        // Child rows created for recurring schedules should not create/update
        // standalone native Discord events. Recurrence is managed on the parent.
        if (eventData.parentEventId) {
            await eventDomainService.disableEventMirror(eventData.id);
            return;
        }

        if (eventData.discordScheduledEventId) {
            await this.updateDiscordScheduledEvent(eventData, guild);
        } else {
            const discordEventId = await this.createDiscordScheduledEvent(eventData, guild);
            if (discordEventId) {
                await eventDomainService.setEventDiscordScheduledEventId(eventId, discordEventId);
            }
        }
    }

    async setEventMessageId(eventId: string, messageId: string): Promise<void> {
        await eventDomainService.setEventMessageId(eventId, messageId);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // RSVP MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════════

    async getRsvp(eventId: string, userId: string): Promise<EventRsvp | undefined> {
        const [result] = await db
            .select()
            .from(eventRsvp)
            .where(and(eq(eventRsvp.eventId, eventId), eq(eventRsvp.userId, userId)));
        return result;
    }

    async getRsvpsByEvent(eventId: string, status?: string): Promise<EventRsvp[]> {
        const conditions = [eq(eventRsvp.eventId, eventId)];

        if (status) {
            conditions.push(eq(eventRsvp.status, status as any));
        }

        return await db.select().from(eventRsvp).where(and(...conditions)).orderBy(desc(eventRsvp.respondedAt));
    }

    async getRsvpCounts(eventId: string): Promise<{ yes: number; no: number; maybe: number; waitlist: number }> {
        const rsvps = await this.getRsvpsByEvent(eventId);

        return {
            yes: rsvps.filter(r => r.status === 'YES').length,
            no: rsvps.filter(r => r.status === 'NO').length,
            maybe: rsvps.filter(r => r.status === 'MAYBE').length,
            waitlist: rsvps.filter(r => r.status === 'WAITLIST').length,
        };
    }

    async setRsvp(data: RsvpData): Promise<{ success: boolean; waitlisted?: boolean; message?: string }> {
        const eventData = await this.getEventById(data.eventId);
        if (!eventData) {
            return { success: false, message: 'Event not found' };
        }

        if (eventData.status === 'CANCELLED') {
            return { success: false, message: 'This event has been cancelled' };
        }

        if (eventData.status === 'COMPLETED') {
            return { success: false, message: 'This event has already ended' };
        }

        // Check if RSVPs are closed
        if (eventData.closeRsvpBeforeStartMinutes) {
            const closeTime = new Date(eventData.startTime.getTime() - eventData.closeRsvpBeforeStartMinutes * 60000);
            if (new Date() >= closeTime) {
                return { success: false, message: 'RSVPs are closed for this event' };
            }
        }

        // Check role restrictions
        if (eventData.blockedRoleIds?.length) {
            // This check needs to be done at the interaction level with member.roles
            // We just check here if there are restrictions in place
        }

        let status = data.status;
        let waitlisted = false;

        // Check attendee limit for YES responses
        if (status === 'YES' && eventData.maxAttendees) {
            const counts = await this.getRsvpCounts(data.eventId);
            if (counts.yes >= eventData.maxAttendees && !eventData.enableWaitlist) {
                return { success: false, message: 'This event is full' };
            }
            if (counts.yes >= eventData.maxAttendees && eventData.enableWaitlist) {
                status = 'WAITLIST' as any;
                waitlisted = true;
            }
        }

        const existingRsvp = await this.getRsvp(data.eventId, data.userId);

        if (existingRsvp) {
            // Update existing RSVP
            if (existingRsvp.status === 'YES' && status !== 'YES') {
                // User is changing from YES to something else
                // Move first waitlisted person to YES if applicable
                await this.promoteFromWaitlist(data.eventId);
            }

            await db
                .update(eventRsvp)
                .set({
                    status: status as any,
                    note: data.note,
                    respondedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(and(eq(eventRsvp.eventId, data.eventId), eq(eventRsvp.userId, data.userId)));
        } else {
            // Create new RSVP
            const rsvpData: NewEventRsvp = {
                eventId: data.eventId,
                userId: data.userId,
                status: status as any,
                note: data.note,
            };
            await db.insert(eventRsvp).values(rsvpData);
        }

        // Trigger webhook for RSVP
        const eventType = status === 'YES' ? 'rsvp.yes' :
            status === 'NO' ? 'rsvp.no' :
                status === 'MAYBE' ? 'rsvp.maybe' :
                    status === 'WAITLIST' ? 'rsvp.waitlist' : 'rsvp.updated';

        await webhookService.triggerEvent(eventData.guildId, eventType, {
            eventId: data.eventId,
            userId: data.userId,
            status: status,
            waitlisted,
            eventTitle: eventData.title,
        });

        return { success: true, waitlisted, message: waitlisted ? 'You have been added to the waitlist' : undefined };
    }

    async removeRsvp(eventId: string, userId: string): Promise<boolean> {
        const existing = await this.getRsvp(eventId, userId);
        if (!existing) return false;

        await db
            .delete(eventRsvp)
            .where(and(eq(eventRsvp.eventId, eventId), eq(eventRsvp.userId, userId)));

        // If user was attending, promote from waitlist
        if (existing.status === 'YES') {
            await this.promoteFromWaitlist(eventId);
        }

        return true;
    }

    async promoteFromWaitlist(eventId: string): Promise<string | null> {
        return await db.transaction(async (tx) => {
            // Get event data within transaction
            const [eventData] = await tx
                .select()
                .from(event)
                .where(eq(event.id, eventId));

            if (!eventData || !eventData.enableWaitlist) return null;

            // Check if there's actually a spot available
            if (eventData.maxAttendees) {
                const [countResult] = await tx
                    .select({ count: sql<number>`count(*)`.mapWith(Number) })
                    .from(eventRsvp)
                    .where(and(
                        eq(eventRsvp.eventId, eventId),
                        eq(eventRsvp.status, 'YES')
                    ));

                if (countResult.count >= eventData.maxAttendees) {
                    // Event is still full, don't promote
                    return null;
                }
            }

            // Find first waitlisted person
            const [firstWaitlisted] = await tx
                .select()
                .from(eventRsvp)
                .where(and(
                    eq(eventRsvp.eventId, eventId),
                    eq(eventRsvp.status, 'WAITLIST')
                ))
                .orderBy(asc(eventRsvp.respondedAt))
                .limit(1);

            if (firstWaitlisted) {
                await tx
                    .update(eventRsvp)
                    .set({ status: 'YES', updatedAt: new Date() })
                    .where(eq(eventRsvp.id, firstWaitlisted.id));
                return firstWaitlisted.userId;
            }

            return null;
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // REMINDERS
    // ═══════════════════════════════════════════════════════════════════════════════

    async setReminder(eventId: string, userId: string, minutesBefore: number): Promise<boolean> {
        try {
            const reminderData: NewEventReminder = {
                eventId,
                userId,
                minutesBefore,
            };
            await db.insert(eventReminder).values(reminderData);
            return true;
        } catch {
            // Duplicate reminder
            return false;
        }
    }

    async upsertReminder(eventId: string, userId: string, minutesBefore: number): Promise<ReminderUpsertResult> {
        return await db.transaction(async (tx) => {
            const existingReminders = await tx
                .select()
                .from(eventReminder)
                .where(and(
                    eq(eventReminder.eventId, eventId),
                    eq(eventReminder.userId, userId),
                ))
                .orderBy(desc(eventReminder.createdAt));

            const latestExisting = existingReminders[0];
            if (
                existingReminders.length === 1 &&
                latestExisting.minutesBefore === minutesBefore &&
                latestExisting.sentAt === null
            ) {
                return {
                    status: 'unchanged',
                    previousMinutesBefore: latestExisting.minutesBefore,
                };
            }

            if (existingReminders.length > 0) {
                await tx
                    .delete(eventReminder)
                    .where(and(
                        eq(eventReminder.eventId, eventId),
                        eq(eventReminder.userId, userId),
                    ));
            }

            const reminderData: NewEventReminder = {
                eventId,
                userId,
                minutesBefore,
            };
            await tx.insert(eventReminder).values(reminderData);

            return {
                status: existingReminders.length > 0 ? 'updated' : 'created',
                previousMinutesBefore: latestExisting?.minutesBefore,
            };
        });
    }

    async removeReminder(eventId: string, userId: string, minutesBefore: number): Promise<boolean> {
        const result = await db
            .delete(eventReminder)
            .where(
                and(
                    eq(eventReminder.eventId, eventId),
                    eq(eventReminder.userId, userId),
                    eq(eventReminder.minutesBefore, minutesBefore)
                )
            );
        return (result.rowCount ?? 0) > 0;
    }

    async getUserReminders(eventId: string, userId: string): Promise<EventReminder[]> {
        return await db
            .select()
            .from(eventReminder)
            .where(and(eq(eventReminder.eventId, eventId), eq(eventReminder.userId, userId)));
    }

    async getPendingReminders(beforeTime: Date): Promise<{ reminder: EventReminder, event: Event }[]> {
        return await db
            .select({
                reminder: eventReminder,
                event: event,
            })
            .from(eventReminder)
            .innerJoin(event, eq(eventReminder.eventId, event.id))
            .where(
                and(
                    sql`${eventReminder.sentAt} IS NULL`,
                    lte(
                        sql`${event.startTime} - INTERVAL '1 minute' * ${eventReminder.minutesBefore}`,
                        beforeTime
                    ),
                    eq(event.status, 'SCHEDULED')
                )
            );
    }

    async markReminderSent(reminderId: string): Promise<void> {
        await db
            .update(eventReminder)
            .set({ sentAt: new Date() })
            .where(eq(eventReminder.id, reminderId));
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEMPLATES
    // ═══════════════════════════════════════════════════════════════════════════════

    async createTemplate(data: NewEventTemplate): Promise<typeof eventTemplate.$inferSelect> {
        const [created] = await db.insert(eventTemplate).values(data).returning();
        return created;
    }

    async getTemplateById(templateId: string): Promise<EventTemplate | undefined> {
        const [result] = await db.select().from(eventTemplate).where(eq(eventTemplate.id, templateId));
        return result;
    }

    async getTemplatesByGuild(guildId: string): Promise<EventTemplate[]> {
        return await db
            .select()
            .from(eventTemplate)
            .where(eq(eventTemplate.guildId, guildId))
            .orderBy(desc(eventTemplate.createdAt));
    }

    async updateTemplate(templateId: string, data: Partial<NewEventTemplate>): Promise<EventTemplate | undefined> {
        const [updated] = await db
            .update(eventTemplate)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(eventTemplate.id, templateId))
            .returning();
        return updated;
    }

    async deleteTemplate(templateId: string): Promise<boolean> {
        const result = await db.delete(eventTemplate).where(eq(eventTemplate.id, templateId));
        return (result.rowCount ?? 0) > 0;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TIMEZONES
    // ═══════════════════════════════════════════════════════════════════════════════

    async getUserTimezone(userId: string): Promise<string> {
        const [result] = await db
            .select()
            .from(userTimezone)
            .where(eq(userTimezone.userId, userId));
        return result?.timezone ?? 'UTC';
    }

    async setUserTimezone(userId: string, timezone: string, detected = false): Promise<void> {
        const [existing] = await db
            .select()
            .from(userTimezone)
            .where(eq(userTimezone.userId, userId));

        if (existing) {
            await db
                .update(userTimezone)
                .set({ timezone, detectedAutomatically: detected, updatedAt: new Date() })
                .where(eq(userTimezone.id, existing.id));
        } else {
            await db.insert(userTimezone).values({
                userId,
                timezone,
                detectedAutomatically: detected,
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SCHEDULED JOBS
    // ═══════════════════════════════════════════════════════════════════════════════

    async getEventsStartingBetween(start: Date, end: Date): Promise<Event[]> {
        return await db
            .select()
            .from(event)
            .where(
                and(
                    gte(event.startTime, start),
                    lte(event.startTime, end),
                    eq(event.status, 'SCHEDULED')
                )
            );
    }

    async markEventAsStarted(eventId: string): Promise<void> {
        const updated = await eventDomainService.setEventStatus(eventId, 'ACTIVE');

        if (updated) {
            await webhookService.triggerEvent(updated.guildId, 'event.started', {
                eventId: updated.id,
                title: updated.title,
                startTime: updated.startTime,
                channelId: updated.channelId,
                discordScheduledEventId: updated.discordScheduledEventId,
            });
        }
    }

    async markEventAsCompleted(eventId: string): Promise<void> {
        await eventDomainService.setEventStatus(eventId, 'COMPLETED');
    }

    async getActiveEvents(): Promise<Event[]> {
        return await db
            .select()
            .from(event)
            .where(eq(event.status, 'ACTIVE'));
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // REPEATING EVENTS
    // ═══════════════════════════════════════════════════════════════════════════════

    async createRepeatingEvents(parentEvent: Event): Promise<Event[]> {
        return eventDomainService.createRepeatingEvents(parentEvent);
    }

    private resolveScheduledEndTime(
        eventData: Event,
        entityType: GuildScheduledEventEntityType
    ): Date | undefined {
        if (eventData.endTime) {
            return eventData.endTime;
        }

        if (entityType !== GuildScheduledEventEntityType.External) {
            return undefined;
        }

        const durationMinutes = eventData.durationMinutes && eventData.durationMinutes > 0
            ? eventData.durationMinutes
            : 60;

        return new Date(eventData.startTime.getTime() + durationMinutes * 60000);
    }

    private async resolveScheduledEventLocationConfig(
        eventData: Event,
        guild: Guild
    ): Promise<{
        entityType: GuildScheduledEventEntityType;
        channelId?: string;
        entityMetadata?: { location: string };
    }> {
        const locationChannel = eventData.locationChannelId
            ? await guild.channels.fetch(eventData.locationChannelId).catch(() => null)
            : null;

        if (locationChannel?.isVoiceBased()) {
            return {
                entityType: locationChannel.type === ChannelType.GuildStageVoice
                    ? GuildScheduledEventEntityType.StageInstance
                    : GuildScheduledEventEntityType.Voice,
                channelId: locationChannel.id,
            };
        }

        const legacyChannel = await guild.channels.fetch(eventData.channelId).catch(() => null);
        if (!eventData.locationChannelId && legacyChannel?.isVoiceBased()) {
            return {
                entityType: legacyChannel.type === ChannelType.GuildStageVoice
                    ? GuildScheduledEventEntityType.StageInstance
                    : GuildScheduledEventEntityType.Voice,
                channelId: legacyChannel.id,
            };
        }

        const externalLocation = eventData.location?.trim()
            || (locationChannel ? `In ${locationChannel.name}` : `In ${legacyChannel?.name || 'Discord'}`);

        return {
            entityType: GuildScheduledEventEntityType.External,
            entityMetadata: { location: externalLocation },
        };
    }

    private buildDiscordRecurrenceRule(
        eventData: Event
    ): (GuildScheduledEventRecurrenceRuleOptions & { endAt?: Date }) | null {
        if (eventData.repeatFrequency === 'NONE') {
            return null;
        }

        const weekday = this.toDiscordWeekday(eventData.startTime);
        const common = {
            startAt: eventData.startTime,
            endAt: eventData.repeatUntil ?? undefined,
        };

        switch (eventData.repeatFrequency) {
            case 'DAILY':
                return {
                    ...common,
                    frequency: GuildScheduledEventRecurrenceRuleFrequency.Daily,
                    interval: 1,
                    byWeekday: [
                        GuildScheduledEventRecurrenceRuleWeekday.Monday,
                        GuildScheduledEventRecurrenceRuleWeekday.Tuesday,
                        GuildScheduledEventRecurrenceRuleWeekday.Wednesday,
                        GuildScheduledEventRecurrenceRuleWeekday.Thursday,
                        GuildScheduledEventRecurrenceRuleWeekday.Friday,
                        GuildScheduledEventRecurrenceRuleWeekday.Saturday,
                        GuildScheduledEventRecurrenceRuleWeekday.Sunday,
                    ],
                };
            case 'WEEKLY':
                return {
                    ...common,
                    frequency: GuildScheduledEventRecurrenceRuleFrequency.Weekly,
                    interval: 1,
                    byWeekday: [weekday],
                };
            case 'BIWEEKLY':
                return {
                    ...common,
                    frequency: GuildScheduledEventRecurrenceRuleFrequency.Weekly,
                    interval: 2,
                    byWeekday: [weekday],
                };
            case 'MONTHLY':
                return {
                    ...common,
                    frequency: GuildScheduledEventRecurrenceRuleFrequency.Monthly,
                    interval: 1,
                    byNWeekday: [{ day: weekday, n: this.getWeekOfMonth(eventData.startTime) }],
                };
            case 'YEARLY':
                return {
                    ...common,
                    frequency: GuildScheduledEventRecurrenceRuleFrequency.Yearly,
                    interval: 1,
                    byMonth: [eventData.startTime.getUTCMonth() + 1],
                    byMonthDay: [eventData.startTime.getUTCDate()],
                };
            default:
                return null;
        }
    }

    private toDiscordWeekday(date: Date): GuildScheduledEventRecurrenceRuleWeekday {
        const utcDay = date.getUTCDay();
        const map: Record<number, GuildScheduledEventRecurrenceRuleWeekday> = {
            0: GuildScheduledEventRecurrenceRuleWeekday.Sunday,
            1: GuildScheduledEventRecurrenceRuleWeekday.Monday,
            2: GuildScheduledEventRecurrenceRuleWeekday.Tuesday,
            3: GuildScheduledEventRecurrenceRuleWeekday.Wednesday,
            4: GuildScheduledEventRecurrenceRuleWeekday.Thursday,
            5: GuildScheduledEventRecurrenceRuleWeekday.Friday,
            6: GuildScheduledEventRecurrenceRuleWeekday.Saturday,
        };
        return map[utcDay];
    }

    private getWeekOfMonth(date: Date): number {
        return Math.floor((date.getUTCDate() - 1) / 7) + 1;
    }
}

export const eventService = new EventService();
