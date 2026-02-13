import { NextRequest, NextResponse } from 'next/server';
import { db, event, eventRsvp, eventPollSettings } from '@/lib/db';
import { eq, and, or, asc, desc, gte, lt } from 'drizzle-orm';
import { getDiscordUsers } from '@/lib/discord-user-cache';
import { authorizeGuildApiRequest } from '@/lib/guild-api-auth';
import logger from '@/lib/logger';
import { dispatchGuildWebhookEvent } from '@/lib/webhook-dispatch';

// Validation constants
const MAX_EVENT_TITLE_LENGTH = 100;
const MAX_EVENT_DESCRIPTION_LENGTH = 2000;
const MAX_EVENT_LOCATION_LENGTH = 100;
const MAX_RECURRING_INSTANCES = 52; // Max 1 year of weekly events

async function createRecurringChildren(parent: typeof event.$inferSelect): Promise<void> {
    if (parent.repeatFrequency === 'NONE' || !parent.repeatUntil) return;

    const created: Array<typeof event.$inferInsert> = [];
    let currentDate = new Date(parent.startTime);
    const endDate = parent.repeatUntil;

    while (currentDate < endDate && created.length < MAX_RECURRING_INSTANCES) {
        switch (parent.repeatFrequency) {
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
            default:
                currentDate = endDate;
                break;
        }

        if (currentDate >= endDate) break;

        created.push({
            guildId: parent.guildId,
            creatorId: parent.creatorId,
            channelId: parent.channelId,
            messageId: null,
            title: parent.title,
            description: parent.description,
            location: parent.location,
            locationChannelId: parent.locationChannelId,
            imageUrl: parent.imageUrl,
            color: parent.color,
            startTime: new Date(currentDate),
            endTime: parent.endTime
                ? new Date(currentDate.getTime() + (parent.endTime.getTime() - parent.startTime.getTime()))
                : null,
            durationMinutes: parent.durationMinutes,
            status: 'SCHEDULED',
            maxAttendees: parent.maxAttendees,
            enableWaitlist: parent.enableWaitlist,
            mentionRoleIds: parent.mentionRoleIds,
            mentionOnCreate: parent.mentionOnCreate,
            mentionOnStart: parent.mentionOnStart,
            requiredRoleIds: parent.requiredRoleIds,
            blockedRoleIds: parent.blockedRoleIds,
            attendeeRoleId: parent.attendeeRoleId,
            repeatFrequency: parent.repeatFrequency,
            repeatUntil: parent.repeatUntil,
            parentEventId: parent.id,
            mirrorToDiscord: false,
            discordScheduledEventId: null,
        });
    }

    if (created.length > 0) {
        await db.insert(event).values(created);
    }
}

// GET /api/guilds/[guildId]/events - List all events for a guild
export async function GET(
    request: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    try {
        const { guildId: guildIdRaw } = await props.params;
        if (!guildIdRaw) {
            return NextResponse.json({ error: 'Guild ID is required' }, { status: 400 });
        }
        const guildId = guildIdRaw;
        const auth = await authorizeGuildApiRequest(request, guildId, 'events:read');
        if ('response' in auth) {
            return auth.response;
        }
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const upcoming = searchParams.get('upcoming') === 'true';
        const past = searchParams.get('past') === 'true';
        const now = new Date();

        let whereClause: any = eq(event.guildId, guildId);
        let orderByClause: any = asc(event.startTime);

        if (upcoming) {
            whereClause = and(
                eq(event.guildId, guildId),
                or(
                    eq(event.status, 'ACTIVE'),
                    and(eq(event.status, 'SCHEDULED'), gte(event.startTime, now))
                )
            );
            orderByClause = asc(event.startTime);
        } else if (past) {
            whereClause = and(
                eq(event.guildId, guildId),
                or(
                    eq(event.status, 'COMPLETED'),
                    and(eq(event.status, 'CANCELLED'), lt(event.startTime, now)),
                    and(eq(event.status, 'SCHEDULED'), lt(event.startTime, now)),
                    and(eq(event.status, 'ACTIVE'), lt(event.startTime, now))
                )
            );
            orderByClause = desc(event.startTime);
        } else if (status) {
            whereClause = and(eq(event.guildId, guildId), eq(event.status, status as any));
            orderByClause = asc(event.startTime);
        }

        const events = await db
            .select()
            .from(event)
            .where(whereClause)
            .orderBy(orderByClause);

        const rsvpRowsByEvent = await Promise.all(
            events.map((evt) =>
                db.select().from(eventRsvp).where(eq(eventRsvp.eventId, evt.id))
            )
        );
        const userMap = await getDiscordUsers(
            rsvpRowsByEvent.flatMap((rows) => rows.map((rsvp) => rsvp.userId))
        );

        const toUserSummary = (userId: string) => {
            const cached = userMap.get(userId);
            return {
                userId,
                displayName: cached?.globalName || cached?.username || `User ${userId.slice(-4)}`,
                avatarUrl: cached?.avatarUrl || null,
            };
        };

        // Get RSVP counts and users for each event
        const eventsWithCounts = events.map((evt, index) => {
            const rsvps = rsvpRowsByEvent[index];

            return {
                ...evt,
                rsvpCounts: {
                    yes: rsvps.filter(r => r.status === 'YES').length,
                    no: rsvps.filter(r => r.status === 'NO').length,
                    maybe: rsvps.filter(r => r.status === 'MAYBE').length,
                    waitlist: rsvps.filter(r => r.status === 'WAITLIST').length,
                },
                rsvpUsers: {
                    yes: rsvps.filter((rsvp) => rsvp.status === 'YES').map((rsvp) => toUserSummary(rsvp.userId)),
                    maybe: rsvps.filter((rsvp) => rsvp.status === 'MAYBE').map((rsvp) => toUserSummary(rsvp.userId)),
                    no: rsvps.filter((rsvp) => rsvp.status === 'NO').map((rsvp) => toUserSummary(rsvp.userId)),
                    waitlist: rsvps.filter((rsvp) => rsvp.status === 'WAITLIST').map((rsvp) => toUserSummary(rsvp.userId)),
                },
            };
        });

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
        const { guildId: guildIdRaw } = await props.params;
        if (!guildIdRaw) {
            return NextResponse.json({ error: 'Guild ID is required' }, { status: 400 });
        }
        const guildId = guildIdRaw;
        const auth = await authorizeGuildApiRequest(request, guildId, 'events:write');
        if ('response' in auth) {
            return auth.response;
        }
        
        const body = await request.json();

        // Validate required fields
        if (!body.title || !body.startTime || !body.channelId) {
            return NextResponse.json(
                { error: 'Missing required fields: title, startTime, channelId' },
                { status: 400 }
            );
        }

        // Validate field lengths
        if (body.title.length > MAX_EVENT_TITLE_LENGTH) {
            return NextResponse.json(
                { error: `Title cannot exceed ${MAX_EVENT_TITLE_LENGTH} characters` },
                { status: 400 }
            );
        }

        if (body.description && body.description.length > MAX_EVENT_DESCRIPTION_LENGTH) {
            return NextResponse.json(
                { error: `Description cannot exceed ${MAX_EVENT_DESCRIPTION_LENGTH} characters` },
                { status: 400 }
            );
        }

        if (body.location && body.location.length > MAX_EVENT_LOCATION_LENGTH) {
            return NextResponse.json(
                { error: `Location cannot exceed ${MAX_EVENT_LOCATION_LENGTH} characters` },
                { status: 400 }
            );
        }

        // Validate recurring event limits
        if (body.repeatFrequency && body.repeatFrequency !== 'NONE' && body.repeatUntil) {
            const startDate = new Date(body.startTime);
            const endDate = new Date(body.repeatUntil);
            const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let maxDays: number;
            switch (body.repeatFrequency) {
                case 'DAILY': maxDays = MAX_RECURRING_INSTANCES; break;
                case 'WEEKLY': maxDays = MAX_RECURRING_INSTANCES * 7; break;
                case 'BIWEEKLY': maxDays = MAX_RECURRING_INSTANCES * 14; break;
                case 'MONTHLY': maxDays = MAX_RECURRING_INSTANCES * 31; break;
                case 'YEARLY': maxDays = MAX_RECURRING_INSTANCES * 365; break;
                default: maxDays = MAX_RECURRING_INSTANCES * 7;
            }

            if (diffDays > maxDays) {
                return NextResponse.json(
                    { error: `Recurring events cannot span more than ${MAX_RECURRING_INSTANCES} instances` },
                    { status: 400 }
                );
            }
        }

        // Validate maxAttendees
        if (body.maxAttendees !== undefined) {
            const maxAttendees = Number(body.maxAttendees);
            if (isNaN(maxAttendees) || maxAttendees < 0 || maxAttendees > 1000) {
                return NextResponse.json(
                    { error: 'maxAttendees must be between 0 and 1000' },
                    { status: 400 }
                );
            }
        }

        let mirrorToDiscord = body.mirrorToDiscord as boolean | undefined;
        if (mirrorToDiscord === undefined) {
            const [settings] = await db
                .select()
                .from(eventPollSettings)
                .where(eq(eventPollSettings.guildId, guildId));
            mirrorToDiscord = settings?.mirrorToDiscordEvents ?? true;
        }

        const startTime = new Date(body.startTime);
        const endTime = body.endTime ? new Date(body.endTime) : null;
        const durationMinutes = body.durationMinutes as number | undefined;
        const normalizedDurationMinutes = durationMinutes
            ?? (endTime ? Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60000)) : 60);

        const [created] = await db
            .insert(event)
            .values({
                guildId: guildId as string,
                creatorId: auth.userId,
                title: body.title as string,
                description: body.description as string | undefined,
                location: body.location as string | undefined,
                locationChannelId: body.locationChannelId as string | undefined,
                imageUrl: body.imageUrl as string | undefined,
                color: body.color as string | undefined,
                channelId: body.channelId as string,
                startTime,
                endTime,
                durationMinutes: normalizedDurationMinutes,
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
                mirrorToDiscord,
                status: 'SCHEDULED',
            })
            .returning();

        await createRecurringChildren(created);

        await dispatchGuildWebhookEvent(guildId, 'event.created', {
            eventId: created.id,
            title: created.title,
            creatorId: created.creatorId,
            startTime: created.startTime,
            channelId: created.channelId,
            locationChannelId: created.locationChannelId,
            mirrorToDiscord: created.mirrorToDiscord,
            discordScheduledEventId: created.discordScheduledEventId,
        });

        return NextResponse.json(created);
    } catch (error) {
        logger.error('Error creating event:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
