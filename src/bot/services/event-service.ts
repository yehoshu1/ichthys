import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';
import { db } from '@shared/database/client';
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
    title: string;
    startTime: Date;
    description?: string;
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
}

export interface RsvpData {
    eventId: string;
    userId: string;
    status: 'YES' | 'NO' | 'MAYBE';
    note?: string;
}

export class EventService {
    // ═══════════════════════════════════════════════════════════════════════════════
    // EVENT CRUD
    // ═══════════════════════════════════════════════════════════════════════════════

    async createEvent(data: CreateEventData): Promise<Event> {
        const eventData: NewEvent = {
            guildId: data.guildId,
            creatorId: data.creatorId,
            channelId: data.channelId,
            title: data.title,
            description: data.description,
            location: data.location,
            imageUrl: data.imageUrl,
            startTime: data.startTime,
            endTime: data.endTime,
            durationMinutes: data.durationMinutes,
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
            status: 'SCHEDULED',
        };

        const [created] = await db.insert(event).values(eventData).returning();
        return created;
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

    async updateEvent(eventId: string, data: Partial<NewEvent>): Promise<Event | undefined> {
        const [updated] = await db
            .update(event)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(event.id, eventId))
            .returning();
        return updated;
    }

    async deleteEvent(eventId: string): Promise<boolean> {
        const result = await db.delete(event).where(eq(event.id, eventId));
        return (result.rowCount ?? 0) > 0;
    }

    async cancelEvent(eventId: string): Promise<Event | undefined> {
        return this.updateEvent(eventId, { status: 'CANCELLED' });
    }

    async setEventMessageId(eventId: string, messageId: string): Promise<void> {
        await db.update(event).set({ messageId }).where(eq(event.id, eventId));
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
        const eventData = await this.getEventById(eventId);
        if (!eventData || !eventData.enableWaitlist) return null;

        // Find first waitlisted person
        const [firstWaitlisted] = await db
            .select()
            .from(eventRsvp)
            .where(and(eq(eventRsvp.eventId, eventId), eq(eventRsvp.status, 'WAITLIST')))
            .orderBy(asc(eventRsvp.respondedAt))
            .limit(1);

        if (firstWaitlisted) {
            await db
                .update(eventRsvp)
                .set({ status: 'YES', updatedAt: new Date() })
                .where(eq(eventRsvp.id, firstWaitlisted.id));
            return firstWaitlisted.userId;
        }

        return null;
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

    async getPendingReminders(beforeTime: Date): Promise<{reminder: EventReminder, event: Event}[]> {
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
        await db.update(event).set({ status: 'ACTIVE' }).where(eq(event.id, eventId));
    }

    async markEventAsCompleted(eventId: string): Promise<void> {
        await db.update(event).set({ status: 'COMPLETED' }).where(eq(event.id, eventId));
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // REPEATING EVENTS
    // ═══════════════════════════════════════════════════════════════════════════════

    async createRepeatingEvents(parentEvent: Event): Promise<Event[]> {
        if (parentEvent.repeatFrequency === 'NONE' || !parentEvent.repeatUntil) {
            return [];
        }

        const created: Event[] = [];
        let currentDate = new Date(parentEvent.startTime);
        const endDate = parentEvent.repeatUntil;

        while (currentDate < endDate) {
            // Calculate next date based on frequency
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

            // Create new event instance
            const newEventData: NewEvent = {
                ...parentEvent,
                id: undefined as any, // Will be generated
                startTime: currentDate,
                endTime: parentEvent.endTime
                    ? new Date(currentDate.getTime() + (parentEvent.endTime.getTime() - parentEvent.startTime.getTime()))
                    : undefined,
                parentEventId: parentEvent.id,
                messageId: undefined,
                createdAt: undefined,
                updatedAt: undefined,
            };

            const [newEvent] = await db.insert(event).values(newEventData).returning();
            created.push(newEvent);
        }

        return created;
    }
}

export const eventService = new EventService();
