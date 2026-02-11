import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@shared/database/client';
import { event, eventRsvp } from '@shared/database/schema';
import { eq, and, asc } from 'drizzle-orm';
import logger from '@/lib/logger';

// GET /api/guilds/[guildId]/events - List all events for a guild
export async function GET(
    request: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { guildId: guildIdRaw } = await props.params;
        if (!guildIdRaw) {
            return NextResponse.json({ error: 'Guild ID is required' }, { status: 400 });
        }
        const guildId = guildIdRaw;
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const upcoming = searchParams.get('upcoming') === 'true';

        let query = db.select().from(event).where(eq(event.guildId, guildId));

        if (status) {
            query = db.select().from(event).where(
                and(eq(event.guildId, guildId), eq(event.status, status as any))
            );
        }

        if (upcoming) {
            query = db.select().from(event).where(
                and(
                    eq(event.guildId, guildId),
                    eq(event.status, 'SCHEDULED')
                )
            );
        }

        const events = await query.orderBy(asc(event.startTime));

        // Get RSVP counts for each event
        const eventsWithCounts = await Promise.all(
            events.map(async (evt) => {
                const rsvps = await db
                    .select()
                    .from(eventRsvp)
                    .where(eq(eventRsvp.eventId, evt.id));

                return {
                    ...evt,
                    rsvpCounts: {
                        yes: rsvps.filter(r => r.status === 'YES').length,
                        no: rsvps.filter(r => r.status === 'NO').length,
                        maybe: rsvps.filter(r => r.status === 'MAYBE').length,
                        waitlist: rsvps.filter(r => r.status === 'WAITLIST').length,
                    },
                };
            })
        );

        return NextResponse.json(eventsWithCounts);
    } catch (error) {
        logger.error('Error fetching events:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/guilds/[guildId]/events - Create a new event
export async function POST(
    request: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { guildId: guildIdRaw } = await props.params;
        if (!guildIdRaw) {
            return NextResponse.json({ error: 'Guild ID is required' }, { status: 400 });
        }
        const guildId = guildIdRaw;
        
        const body = await request.json();

        // Validate required fields
        if (!body.title || !body.startTime || !body.channelId) {
            return NextResponse.json(
                { error: 'Missing required fields: title, startTime, channelId' },
                { status: 400 }
            );
        }

        const newEvent = await db
            .insert(event)
            .values({
                guildId: guildId as string,
                creatorId: session.user.id as string,
                title: body.title as string,
                description: body.description as string | undefined,
                location: body.location as string | undefined,
                imageUrl: body.imageUrl as string | undefined,
                channelId: body.channelId as string,
                startTime: new Date(body.startTime),
                endTime: body.endTime ? new Date(body.endTime) : undefined,
                durationMinutes: body.durationMinutes as number | undefined,
                maxAttendees: body.maxAttendees as number | undefined,
                enableWaitlist: (body.enableWaitlist ?? false) as boolean,
                mentionRoleIds: body.mentionRoleIds as string[] | undefined,
                mentionOnCreate: (body.mentionOnCreate ?? false) as boolean,
                mentionOnStart: (body.mentionOnStart ?? false) as boolean,
                requiredRoleIds: body.requiredRoleIds as string[] | undefined,
                blockedRoleIds: body.blockedRoleIds as string[] | undefined,
                attendeeRoleId: body.attendeeRoleId as string | undefined,
                repeatFrequency: (body.repeatFrequency || 'NONE') as 'NONE' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'YEARLY',
                repeatUntil: body.repeatUntil ? new Date(body.repeatUntil) : undefined,
            })
            .returning();

        return NextResponse.json(newEvent[0]);
    } catch (error) {
        logger.error('Error creating event:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
