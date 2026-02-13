import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte } from 'drizzle-orm';
import { createHash } from 'crypto';
import { db } from '@shared/database/client';
import { event, eventRsvp } from '@shared/database/schema';

function getCalendarSecret(): string {
    const secret = process.env.CALENDAR_SECRET;
    if (!secret || secret.trim().length < 16) {
        throw new Error('CALENDAR_SECRET is required and must be at least 16 characters');
    }
    return secret;
}

function validateToken(userId: string, tokenInput: string): boolean {
    const token = tokenInput.endsWith('.ics') ? tokenInput.slice(0, -4) : tokenInput;
    const expected = createHash('sha256')
        .update(`${userId}-${getCalendarSecret()}`)
        .digest('hex')
        .substring(0, 32);
    return token === expected;
}

function formatDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeICS(text: string): string {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '');
}

function buildIcs(eventsData: Array<{
    id: string;
    guildId: string;
    title: string;
    description: string | null;
    location: string | null;
    startTime: Date;
    endTime: Date | null;
}>): string {
    const lines: string[] = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Ixoye Bot//Event Calendar//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Ixoye Events',
        'X-WR-TIMEZONE:UTC',
    ];

    for (const evt of eventsData) {
        const uid = createHash('md5').update(`${evt.guildId}-${evt.id}@ixoye-bot`).digest('hex');
        const endTime = evt.endTime || new Date(evt.startTime.getTime() + 60 * 60 * 1000);

        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${uid}@ixoye-bot`);
        lines.push(`DTSTAMP:${formatDate(new Date())}`);
        lines.push(`DTSTART:${formatDate(evt.startTime)}`);
        lines.push(`DTEND:${formatDate(endTime)}`);
        lines.push(`SUMMARY:${escapeICS(evt.title)}`);

        if (evt.description) {
            lines.push(`DESCRIPTION:${escapeICS(evt.description)}`);
        }
        if (evt.location) {
            lines.push(`LOCATION:${escapeICS(evt.location)}`);
        }

        lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
}

// GET /api/calendar/[userId]/[token].ics - Personal calendar feed
export async function GET(
    _request: NextRequest,
    props: { params: Promise<{ userId: string; token: string }> }
) {
    try {
        const { userId, token } = await props.params;

        if (!validateToken(userId, token)) {
            return new NextResponse('Invalid token', { status: 401 });
        }

        const rows = await db
            .select({
                eventId: event.id,
                guildId: event.guildId,
                title: event.title,
                description: event.description,
                location: event.location,
                startTime: event.startTime,
                endTime: event.endTime,
            })
            .from(eventRsvp)
            .innerJoin(event, eq(eventRsvp.eventId, event.id))
            .where(and(
                eq(eventRsvp.userId, userId),
                eq(eventRsvp.status, 'YES'),
                gte(event.startTime, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
            ));

        const icsContent = buildIcs(rows.map((row) => ({
            id: row.eventId,
            guildId: row.guildId,
            title: row.title,
            description: row.description,
            location: row.location,
            startTime: row.startTime,
            endTime: row.endTime,
        })));

        return new NextResponse(icsContent, {
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': 'attachment; filename="ixoye-calendar.ics"',
                'Cache-Control': 'no-cache',
            },
        });
    } catch (error) {
        console.error('Error generating calendar feed:', error);
        return new NextResponse('Internal server error', { status: 500 });
    }
}
