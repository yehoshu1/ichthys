import { NextRequest, NextResponse } from 'next/server';
import { db, event, eventRsvp } from '@/lib/db';
import { eq, and, or, asc, desc, gte, lt, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDiscordUsers } from '@/lib/discord-user-cache';
import { authorizeGuildApiRequest } from '@/lib/guild-api-auth';
import logger from '@/lib/logger';
import { requireGuildModuleEnabled } from '@/lib/module-gate';
import { eventService } from '@shared/services/event-domain-service';

// Validation constants
const MAX_EVENT_TITLE_LENGTH = 100;
const MAX_EVENT_DESCRIPTION_LENGTH = 2000;
const MAX_EVENT_LOCATION_LENGTH = 100;
const MAX_RECURRING_INSTANCES = 52; // Max 1 year of weekly events

const repeatFrequencySchema = z.enum(['NONE', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY']);

const createEventSchema = z.object({
    title: z.string().min(1).max(MAX_EVENT_TITLE_LENGTH),
    startTime: z.string().datetime(),
    channelId: z.string().min(1),
    description: z.string().max(MAX_EVENT_DESCRIPTION_LENGTH).nullable().optional(),
    location: z.string().max(MAX_EVENT_LOCATION_LENGTH).nullable().optional(),
    locationChannelId: z.string().nullable().optional(),
    imageUrl: z.string().max(2048).nullable().optional(),
    color: z.string().max(32).nullable().optional(),
    endTime: z.string().datetime().nullable().optional(),
    durationMinutes: z.number().int().min(1).max(60 * 24 * 31).nullable().optional(),
    maxAttendees: z.number().int().min(0).max(1000).nullable().optional(),
    enableWaitlist: z.boolean().optional(),
    mentionRoleIds: z.array(z.string()).nullable().optional(),
    mentionOnCreate: z.boolean().optional(),
    mentionOnStart: z.boolean().optional(),
    requiredRoleIds: z.array(z.string()).nullable().optional(),
    blockedRoleIds: z.array(z.string()).nullable().optional(),
    attendeeRoleId: z.string().nullable().optional(),
    repeatFrequency: repeatFrequencySchema.nullable().optional(),
    repeatUntil: z.string().datetime().nullable().optional(),
    mirrorToDiscord: z.boolean().optional(),
}).strict();

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
        const moduleGuard = await requireGuildModuleEnabled(guildId, 'events');
        if (moduleGuard) return moduleGuard;
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

        if (events.length === 0) {
            return NextResponse.json([]);
        }

        const eventIds = events.map((evt) => evt.id);
        const rsvpRows = await db
            .select()
            .from(eventRsvp)
            .where(inArray(eventRsvp.eventId, eventIds));

        const rsvpsByEvent = new Map<string, typeof rsvpRows>();
        for (const rsvp of rsvpRows) {
            const existing = rsvpsByEvent.get(rsvp.eventId);
            if (existing) {
                existing.push(rsvp);
            } else {
                rsvpsByEvent.set(rsvp.eventId, [rsvp]);
            }
        }

        const userIds = new Set(rsvpRows.map((row) => row.userId));
        const userMap = await getDiscordUsers(Array.from(userIds));

        const toUserSummary = (userId: string) => {
            const cached = userMap.get(userId);
            return {
                userId,
                displayName: cached?.globalName || cached?.username || `User ${userId.slice(-4)}`,
                avatarUrl: cached?.avatarUrl || null,
            };
        };

        // Get RSVP counts and users for each event
        const eventsWithCounts = events.map((evt) => {
            const rsvps = rsvpsByEvent.get(evt.id) ?? [];

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
        const moduleGuard = await requireGuildModuleEnabled(guildId, 'events');
        if (moduleGuard) return moduleGuard;
        
        const body = await request.json();
        const parsed = createEventSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid request body', details: parsed.error.issues },
                { status: 400 }
            );
        }
        const data = parsed.data;

        // Validate recurring event limits
        if (data.repeatFrequency && data.repeatFrequency !== 'NONE' && data.repeatUntil) {
            const startDate = new Date(data.startTime);
            const endDate = new Date(data.repeatUntil);
            const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let maxDays: number;
            switch (data.repeatFrequency) {
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

        const startTime = new Date(data.startTime);
        const endTime = data.endTime ? new Date(data.endTime) : null;
        const durationMinutes = data.durationMinutes as number | undefined;
        const normalizedDurationMinutes = durationMinutes
            ?? (endTime ? Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60000)) : 60);

        const created = await eventService.createEvent({
            guildId,
            creatorId: auth.userId,
            channelId: data.channelId,
            title: data.title,
            description: data.description ?? undefined,
            location: data.location ?? undefined,
            locationChannelId: data.locationChannelId ?? undefined,
            imageUrl: data.imageUrl ?? undefined,
            color: data.color ?? undefined,
            startTime,
            endTime,
            durationMinutes: normalizedDurationMinutes,
            maxAttendees: data.maxAttendees ?? undefined,
            enableWaitlist: data.enableWaitlist ?? false,
            mentionRoleIds: data.mentionRoleIds ?? undefined,
            mentionOnCreate: data.mentionOnCreate ?? false,
            mentionOnStart: data.mentionOnStart ?? false,
            requiredRoleIds: data.requiredRoleIds ?? undefined,
            blockedRoleIds: data.blockedRoleIds ?? undefined,
            attendeeRoleId: data.attendeeRoleId ?? undefined,
            repeatFrequency: data.repeatFrequency || 'NONE',
            repeatUntil: data.repeatUntil ? new Date(data.repeatUntil) : undefined,
            mirrorToDiscord: data.mirrorToDiscord,
        });

        if (created.repeatFrequency !== 'NONE' && created.repeatUntil) {
            await eventService.createRepeatingEvents(created);
        }

        return NextResponse.json(created);
    } catch (error) {
        logger.error('Error creating event:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
