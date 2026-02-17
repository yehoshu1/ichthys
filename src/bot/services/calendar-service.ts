import { eq, and, gte } from 'drizzle-orm';
import { db } from '@shared/database/client';
import { event, eventRsvp } from '@shared/database/schema';
import { createHash } from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// CALENDAR SERVICE - ICS Feed Generation
// ═══════════════════════════════════════════════════════════════════════════════

export interface CalendarEvent {
    uid: string;
    title: string;
    description?: string;
    location?: string;
    startTime: Date;
    endTime?: Date;
    url?: string;
    createdAt: Date;
}

export class CalendarService {
    private getCalendarSecret(): string {
        const secret = process.env.CALENDAR_SECRET;
        if (!secret || secret.trim().length < 16) {
            throw new Error('CALENDAR_SECRET is required and must be at least 16 characters');
        }
        return secret;
    }

    private generateUID(eventId: string, guildId: string): string {
        const hash = createHash('md5')
            .update(`${guildId}-${eventId}@ixoye-bot`)
            .digest('hex');
        return `${hash}@ixoye-bot`;
    }

    private escapeICS(text: string): string {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '');
    }

    private formatDate(date: Date): string {
        return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    }

    async generateUserCalendarFeed(
        userId: string,
        _options?: { guildId?: string; includeDeclined?: boolean }
    ): Promise<string> {
        // Get events the user is attending
        const rsvps = await db
            .select({
                rsvp: eventRsvp,
                event: event,
            })
            .from(eventRsvp)
            .innerJoin(event, eq(eventRsvp.eventId, event.id))
            .where(
                and(
                    eq(eventRsvp.userId, userId),
                    eq(eventRsvp.status, 'YES'),
                    gte(event.startTime, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
                )
            );

        const events: CalendarEvent[] = rsvps.map(({ event: evt }) => ({
            uid: this.generateUID(evt.id, evt.guildId),
            title: evt.title,
            description: evt.description || undefined,
            location: evt.location || undefined,
            startTime: evt.startTime,
            endTime: evt.endTime || undefined,
            createdAt: evt.createdAt,
        }));

        return this.generateICS(events);
    }

    async generateGuildCalendarFeed(guildId: string): Promise<string> {
        const events = await db
            .select()
            .from(event)
            .where(
                and(
                    eq(event.guildId, guildId),
                    gte(event.startTime, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                )
            );

        const calendarEvents: CalendarEvent[] = events.map(evt => ({
            uid: this.generateUID(evt.id, evt.guildId),
            title: evt.title,
            description: evt.description || undefined,
            location: evt.location || undefined,
            startTime: evt.startTime,
            endTime: evt.endTime || undefined,
            createdAt: evt.createdAt,
        }));

        return this.generateICS(calendarEvents);
    }

    generateICS(events: CalendarEvent[]): string {
        const lines: string[] = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//ΙΧΘΥΣ Bot//Event Calendar//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:ΙΧΘΥΣ Events',
            'X-WR-TIMEZONE:UTC',
        ];

        for (const evt of events) {
            lines.push('BEGIN:VEVENT');
            lines.push(`UID:${evt.uid}`);
            lines.push(`DTSTAMP:${this.formatDate(new Date())}`);
            lines.push(`DTSTART:${this.formatDate(evt.startTime)}`);
            
            if (evt.endTime) {
                lines.push(`DTEND:${this.formatDate(evt.endTime)}`);
            } else {
                // Default 1 hour duration
                const endTime = new Date(evt.startTime.getTime() + 60 * 60 * 1000);
                lines.push(`DTEND:${this.formatDate(endTime)}`);
            }
            
            lines.push(`SUMMARY:${this.escapeICS(evt.title)}`);
            
            if (evt.description) {
                // Fold long lines (max 75 chars per line)
                const escaped = this.escapeICS(evt.description);
                const folded = this.foldLine(`DESCRIPTION:${escaped}`);
                lines.push(...folded);
            }
            
            if (evt.location) {
                lines.push(`LOCATION:${this.escapeICS(evt.location)}`);
            }
            
            if (evt.url) {
                lines.push(`URL:${evt.url}`);
            }
            
            lines.push('END:VEVENT');
        }

        lines.push('END:VCALENDAR');

        return lines.join('\r\n');
    }

    private foldLine(line: string): string[] {
        if (line.length <= 75) return [line];
        
        const lines: string[] = [];
        let current = line;
        
        while (current.length > 75) {
            lines.push(current.substring(0, 75));
            current = ' ' + current.substring(75);
        }
        
        if (current.length > 0) {
            lines.push(current);
        }
        
        return lines;
    }

    // Generate a unique feed URL for a user
    generateFeedUrl(userId: string, baseUrl: string): string {
        const token = createHash('sha256')
            .update(`${userId}-${this.getCalendarSecret()}`)
            .digest('hex')
            .substring(0, 32);
        
        return `${baseUrl}/api/calendar/${userId}/${token}.ics`;
    }

    validateFeedToken(userId: string, token: string): boolean {
        const normalizedToken = token.endsWith('.ics') ? token.slice(0, -4) : token;
        const expected = createHash('sha256')
            .update(`${userId}-${this.getCalendarSecret()}`)
            .digest('hex')
            .substring(0, 32);
        
        return normalizedToken === expected;
    }
}

export const calendarService = new CalendarService();
