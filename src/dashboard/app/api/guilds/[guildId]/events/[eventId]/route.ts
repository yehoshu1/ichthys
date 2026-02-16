import { NextRequest, NextResponse } from 'next/server';
import { db, event, eventRsvp } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { authorizeGuildApiRequest } from '@/lib/guild-api-auth';
import logger from '@/lib/logger';
import { requireGuildModuleEnabled } from '@/lib/module-gate';
import { eventService } from '@shared/services/event-domain-service';

const MAX_EVENT_TITLE_LENGTH = 100;
const MAX_EVENT_DESCRIPTION_LENGTH = 2000;
const MAX_EVENT_LOCATION_LENGTH = 100;

const updateEventSchema = z.object({
    title: z.string().min(1).max(MAX_EVENT_TITLE_LENGTH).optional(),
    description: z.string().max(MAX_EVENT_DESCRIPTION_LENGTH).optional(),
    location: z.string().max(MAX_EVENT_LOCATION_LENGTH).optional(),
    locationChannelId: z.string().nullable().optional(),
    imageUrl: z.string().max(2048).optional(),
    color: z.string().max(32).optional(),
    channelId: z.string().min(1).optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().nullable().optional(),
    durationMinutes: z.number().int().min(1).max(60 * 24 * 31).optional(),
    status: z.enum(['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
    maxAttendees: z.number().int().min(0).max(1000).optional(),
    enableWaitlist: z.boolean().optional(),
    mentionRoleIds: z.array(z.string()).optional(),
    mentionOnCreate: z.boolean().optional(),
    mentionOnStart: z.boolean().optional(),
    requiredRoleIds: z.array(z.string()).optional(),
    blockedRoleIds: z.array(z.string()).optional(),
    attendeeRoleId: z.string().nullable().optional(),
    repeatFrequency: z.enum(['NONE', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY']).optional(),
    repeatUntil: z.string().datetime().nullable().optional(),
    mirrorToDiscord: z.boolean().optional(),
}).strict();

// GET /api/guilds/[guildId]/events/[eventId] - Get a specific event
export async function GET(
    _request: NextRequest,
    props: { params: Promise<{ guildId: string; eventId: string }> }
) {
    try {
        const { guildId, eventId } = await props.params;
        const auth = await authorizeGuildApiRequest(_request, guildId, 'events:read');
        if ('response' in auth) {
            return auth.response;
        }
        const moduleGuard = await requireGuildModuleEnabled(guildId, 'events');
        if (moduleGuard) return moduleGuard;

        const [evt] = await db
            .select()
            .from(event)
            .where(and(eq(event.id, eventId), eq(event.guildId, guildId)));

        if (!evt) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Get RSVPs
        const rsvps = await db
            .select()
            .from(eventRsvp)
            .where(eq(eventRsvp.eventId, eventId));

        return NextResponse.json({
            ...evt,
            rsvps,
            rsvpCounts: {
                yes: rsvps.filter(r => r.status === 'YES').length,
                no: rsvps.filter(r => r.status === 'NO').length,
                maybe: rsvps.filter(r => r.status === 'MAYBE').length,
                waitlist: rsvps.filter(r => r.status === 'WAITLIST').length,
            },
        });
    } catch (error) {
        logger.error('Error fetching event:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/guilds/[guildId]/events/[eventId] - Update an event
export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ guildId: string; eventId: string }> }
) {
    try {
        const { guildId, eventId } = await props.params;
        const auth = await authorizeGuildApiRequest(request, guildId, 'events:write');
        if ('response' in auth) {
            return auth.response;
        }
        const moduleGuard = await requireGuildModuleEnabled(guildId, 'events');
        if (moduleGuard) return moduleGuard;
        const body = await request.json();
        const parsed = updateEventSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid request body', details: parsed.error.issues },
                { status: 400 }
            );
        }
        const data = parsed.data;

        // Check if event exists and belongs to guild
        const [existingEvent] = await db
            .select()
            .from(event)
            .where(and(eq(event.id, eventId), eq(event.guildId, guildId)));

        if (!existingEvent) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Build update object
        const updateData: Partial<typeof event.$inferInsert> = {
            updatedAt: new Date(),
        };

        if (data.title !== undefined) updateData.title = data.title;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.location !== undefined) updateData.location = data.location;
        if (data.locationChannelId !== undefined) updateData.locationChannelId = data.locationChannelId || null;
        if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
        if (data.color !== undefined) updateData.color = data.color;
        if (data.channelId !== undefined) updateData.channelId = data.channelId;
        if (data.startTime !== undefined) updateData.startTime = new Date(data.startTime);
        if (data.endTime !== undefined) updateData.endTime = data.endTime ? new Date(data.endTime) : null;
        if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.maxAttendees !== undefined) updateData.maxAttendees = data.maxAttendees;
        if (data.enableWaitlist !== undefined) updateData.enableWaitlist = data.enableWaitlist;
        if (data.mentionRoleIds !== undefined) updateData.mentionRoleIds = data.mentionRoleIds;
        if (data.mentionOnCreate !== undefined) updateData.mentionOnCreate = data.mentionOnCreate;
        if (data.mentionOnStart !== undefined) updateData.mentionOnStart = data.mentionOnStart;
        if (data.requiredRoleIds !== undefined) updateData.requiredRoleIds = data.requiredRoleIds;
        if (data.blockedRoleIds !== undefined) updateData.blockedRoleIds = data.blockedRoleIds;
        if (data.attendeeRoleId !== undefined) updateData.attendeeRoleId = data.attendeeRoleId || null;
        if (data.repeatFrequency !== undefined) updateData.repeatFrequency = data.repeatFrequency;
        if (data.repeatUntil !== undefined) updateData.repeatUntil = data.repeatUntil ? new Date(data.repeatUntil) : null;
        if (data.mirrorToDiscord !== undefined) updateData.mirrorToDiscord = data.mirrorToDiscord;

        const updatedEvent = await eventService.updateEvent(eventId, updateData);
        if (!updatedEvent) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        return NextResponse.json(updatedEvent);
    } catch (error) {
        logger.error('Error updating event:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/guilds/[guildId]/events/[eventId] - Delete an event
export async function DELETE(
    _request: NextRequest,
    props: { params: Promise<{ guildId: string; eventId: string }> }
) {
    try {
        const { guildId, eventId } = await props.params;
        const auth = await authorizeGuildApiRequest(_request, guildId, 'events:write');
        if ('response' in auth) {
            return auth.response;
        }
        const moduleGuard = await requireGuildModuleEnabled(guildId, 'events');
        if (moduleGuard) return moduleGuard;

        // Check if event exists and belongs to guild
        const [existingEvent] = await db
            .select()
            .from(event)
            .where(and(eq(event.id, eventId), eq(event.guildId, guildId)));

        if (!existingEvent) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        await eventService.deleteEvent(eventId);

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('Error deleting event:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
