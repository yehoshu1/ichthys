import { NextRequest, NextResponse } from 'next/server';
import { db, event, eventRsvp } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { authorizeGuildApiRequest } from '@/lib/guild-api-auth';
import logger from '@/lib/logger';
import { dispatchGuildWebhookEvent } from '@/lib/webhook-dispatch';

async function deleteDiscordMessage(channelId: string | null | undefined, messageId: string | null | undefined): Promise<void> {
    if (!channelId || !messageId) return;
    const token = process.env.DISCORD_TOKEN;
    if (!token) return;

    try {
        await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bot ${token}`,
            },
        });
    } catch (error) {
        logger.warn('Failed to delete Discord event message from dashboard route:', error);
    }
}

async function deleteDiscordScheduledEvent(guildId: string, scheduledEventId: string | null | undefined): Promise<void> {
    if (!scheduledEventId) return;
    const token = process.env.DISCORD_TOKEN;
    if (!token) return;

    try {
        await fetch(`https://discord.com/api/v10/guilds/${guildId}/scheduled-events/${scheduledEventId}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bot ${token}`,
            },
        });
    } catch (error) {
        logger.warn('Failed to delete Discord scheduled event from dashboard route:', error);
    }
}

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
        const body = await request.json();

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

        if (body.title !== undefined) updateData.title = body.title;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.location !== undefined) updateData.location = body.location;
        if (body.locationChannelId !== undefined) updateData.locationChannelId = body.locationChannelId || null;
        if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
        if (body.color !== undefined) updateData.color = body.color;
        if (body.channelId !== undefined) updateData.channelId = body.channelId;
        if (body.startTime !== undefined) updateData.startTime = new Date(body.startTime);
        if (body.endTime !== undefined) updateData.endTime = body.endTime ? new Date(body.endTime) : null;
        if (body.durationMinutes !== undefined) updateData.durationMinutes = body.durationMinutes;
        if (body.status !== undefined) updateData.status = body.status;
        if (body.maxAttendees !== undefined) updateData.maxAttendees = body.maxAttendees;
        if (body.enableWaitlist !== undefined) updateData.enableWaitlist = body.enableWaitlist;
        if (body.mentionRoleIds !== undefined) updateData.mentionRoleIds = body.mentionRoleIds;
        if (body.mentionOnCreate !== undefined) updateData.mentionOnCreate = body.mentionOnCreate;
        if (body.mentionOnStart !== undefined) updateData.mentionOnStart = body.mentionOnStart;
        if (body.requiredRoleIds !== undefined) updateData.requiredRoleIds = body.requiredRoleIds;
        if (body.blockedRoleIds !== undefined) updateData.blockedRoleIds = body.blockedRoleIds;
        if (body.attendeeRoleId !== undefined) updateData.attendeeRoleId = body.attendeeRoleId || null;
        if (body.repeatFrequency !== undefined) updateData.repeatFrequency = body.repeatFrequency;
        if (body.repeatUntil !== undefined) updateData.repeatUntil = body.repeatUntil ? new Date(body.repeatUntil) : null;
        if (body.mirrorToDiscord !== undefined) updateData.mirrorToDiscord = body.mirrorToDiscord;

        const [updatedEvent] = await db
            .update(event)
            .set(updateData)
            .where(eq(event.id, eventId))
            .returning();

        await dispatchGuildWebhookEvent(guildId, 'event.updated', {
            eventId: updatedEvent.id,
            title: updatedEvent.title,
            status: updatedEvent.status,
            startTime: updatedEvent.startTime,
            endTime: updatedEvent.endTime,
            channelId: updatedEvent.channelId,
            locationChannelId: updatedEvent.locationChannelId,
            mirrorToDiscord: updatedEvent.mirrorToDiscord,
            discordScheduledEventId: updatedEvent.discordScheduledEventId,
        });

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

        // Check if event exists and belongs to guild
        const [existingEvent] = await db
            .select()
            .from(event)
            .where(and(eq(event.id, eventId), eq(event.guildId, guildId)));

        if (!existingEvent) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        await deleteDiscordMessage(existingEvent.channelId, existingEvent.messageId);
        if (existingEvent.mirrorToDiscord && existingEvent.discordScheduledEventId) {
            await deleteDiscordScheduledEvent(guildId, existingEvent.discordScheduledEventId);
        }

        await dispatchGuildWebhookEvent(guildId, 'event.deleted', {
            eventId: existingEvent.id,
            title: existingEvent.title,
            status: existingEvent.status,
            startTime: existingEvent.startTime,
            channelId: existingEvent.channelId,
            discordScheduledEventId: existingEvent.discordScheduledEventId,
        });

        await db.delete(eventRsvp).where(eq(eventRsvp.eventId, eventId));
        await db.delete(event).where(eq(event.id, eventId));

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('Error deleting event:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
