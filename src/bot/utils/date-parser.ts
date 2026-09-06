import { DateTime } from 'luxon';

// ═══════════════════════════════════════════════════════════════════════════════
// DATE PARSER - Natural Language Date/Time Parsing
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse natural language date/time strings
 * Supports formats like:
 * - "tomorrow 6pm"
 * - "in 3 hours"
 * - "next friday 2pm"
 * - "2026-02-15 18:00"
 * - "today at 5pm"
 * - "saturday"
 */
export function parseNaturalLanguageDate(input: string, timezone: string = 'UTC'): Date | null {
    const normalized = input.toLowerCase().trim();
    const now = DateTime.now().setZone(timezone);

    // Try exact ISO/date formats first
    const isoDate = DateTime.fromISO(normalized, { zone: timezone });
    if (isoDate.isValid) {
        return isoDate.toJSDate();
    }

    const sqlDate = DateTime.fromSQL(normalized, { zone: timezone });
    if (sqlDate.isValid) {
        return sqlDate.toJSDate();
    }

    const httpDate = DateTime.fromHTTP(normalized);
    if (httpDate.isValid) {
        return httpDate.toJSDate();
    }

    // Parse relative times
    const relativeMatch = parseRelativeTime(normalized, now);
    if (relativeMatch) {
        return relativeMatch.toJSDate();
    }

    // Parse day of week references
    const dayOfWeekMatch = parseDayOfWeek(normalized, now);
    if (dayOfWeekMatch) {
        return dayOfWeekMatch.toJSDate();
    }

    // Parse "tomorrow" or "today"
    const dayMatch = parseDayReference(normalized, now);
    if (dayMatch) {
        return dayMatch.toJSDate();
    }

    // Try to parse with chrono-like patterns
    const chronoMatch = parseChronoLike(normalized, now);
    if (chronoMatch) {
        return chronoMatch.toJSDate();
    }

    return null;
}

function parseRelativeTime(input: string, now: DateTime): DateTime | null {
    // Pattern: "in X minutes/hours/days/weeks"
    const relativeRegex = /in\s+(\d+)\s+(minute|minutes|hour|hours|day|days|week|weeks|month|months)/i;
    const match = input.match(relativeRegex);
    
    if (match) {
        const amount = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        
        switch (unit) {
            case 'minute':
            case 'minutes':
                return now.plus({ minutes: amount });
            case 'hour':
            case 'hours':
                return now.plus({ hours: amount });
            case 'day':
            case 'days':
                return now.plus({ days: amount });
            case 'week':
            case 'weeks':
                return now.plus({ weeks: amount });
            case 'month':
            case 'months':
                return now.plus({ months: amount });
        }
    }

    // Pattern: "X minutes/hours/days from now"
    const fromNowRegex = /(\d+)\s+(minute|minutes|hour|hours|day|days|week|weeks)\s+from\s+now/i;
    const fromNowMatch = input.match(fromNowRegex);
    
    if (fromNowMatch) {
        const amount = parseInt(fromNowMatch[1]);
        const unit = fromNowMatch[2].toLowerCase();
        
        switch (unit) {
            case 'minute':
            case 'minutes':
                return now.plus({ minutes: amount });
            case 'hour':
            case 'hours':
                return now.plus({ hours: amount });
            case 'day':
            case 'days':
                return now.plus({ days: amount });
            case 'week':
            case 'weeks':
                return now.plus({ weeks: amount });
        }
    }

    return null;
}

function parseDayOfWeek(input: string, now: DateTime): DateTime | null {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayShort = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    
    // Pattern: "next friday" or "friday" or "next fri"
    const dayRegex = /(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)(?:\s+at\s+(\d+)(?::(\d+))?\s*(am|pm)?)?/i;
    const match = input.match(dayRegex);
    
    if (match) {
        const dayName = match[1].toLowerCase();
        const isNext = input.includes('next');
        
        let targetDay = days.indexOf(dayName);
        if (targetDay === -1) {
            targetDay = dayShort.indexOf(dayName);
        }
        
        if (targetDay !== -1) {
            let target = now.set({ hour: 12, minute: 0, second: 0 });
            
            // Calculate days to add
            let daysToAdd = targetDay - now.weekday;
            if (daysToAdd <= 0 || isNext) {
                daysToAdd += 7;
            }
            
            target = target.plus({ days: daysToAdd });
            
            // Parse time if provided
            if (match[2]) {
                let hour = parseInt(match[2]);
                const minute = match[3] ? parseInt(match[3]) : 0;
                const ampm = match[4]?.toLowerCase();
                
                if (ampm === 'pm' && hour !== 12) {
                    hour += 12;
                } else if (ampm === 'am' && hour === 12) {
                    hour = 0;
                }
                
                target = target.set({ hour, minute });
            }
            
            return target;
        }
    }
    
    return null;
}

function parseDayReference(input: string, now: DateTime): DateTime | null {
    let target: DateTime | null = null;
    
    if (input.includes('tomorrow')) {
        target = now.plus({ days: 1 }).set({ hour: 12, minute: 0 });
    } else if (input.includes('today')) {
        target = now.set({ hour: 12, minute: 0 });
    } else if (input.includes('tonight')) {
        target = now.set({ hour: 20, minute: 0 });
    } else if (input.includes('noon')) {
        target = now.set({ hour: 12, minute: 0 });
    } else if (input.includes('midnight')) {
        target = now.set({ hour: 0, minute: 0 });
    }
    
    if (target) {
        // Try to extract time
        const timeMatch = input.match(/at\s+(\d+)(?::(\d+))?\s*(am|pm)?/i);
        if (timeMatch) {
            let hour = parseInt(timeMatch[1]);
            const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
            const ampm = timeMatch[3]?.toLowerCase();
            
            if (ampm === 'pm' && hour !== 12) {
                hour += 12;
            } else if (ampm === 'am' && hour === 12) {
                hour = 0;
            }
            
            target = target.set({ hour, minute });
        }
        
        return target;
    }
    
    return null;
}

function parseChronoLike(input: string, now: DateTime): DateTime | null {
    // Try patterns like "6pm", "18:00", "6:30pm"
    const timeRegex = /(\d{1,2}):(\d{2})\s*(am|pm)?|(\d{1,2})\s*(am|pm)/i;
    const timeMatch = input.match(timeRegex);
    
    if (timeMatch) {
        let hour: number;
        let minute: number;
        
        if (timeMatch[1]) {
            // HH:MM format
            hour = parseInt(timeMatch[1]);
            minute = parseInt(timeMatch[2]);
            const ampm = timeMatch[3]?.toLowerCase();
            
            if (ampm === 'pm' && hour !== 12) {
                hour += 12;
            } else if (ampm === 'am' && hour === 12) {
                hour = 0;
            }
        } else {
            // H am/pm format
            hour = parseInt(timeMatch[4]);
            minute = 0;
            const ampm = timeMatch[5]?.toLowerCase();
            
            if (ampm === 'pm' && hour !== 12) {
                hour += 12;
            } else if (ampm === 'am' && hour === 12) {
                hour = 0;
            }
        }
        
        let target = now.set({ hour, minute, second: 0 });
        
        // If time already passed today, assume tomorrow
        if (target < now) {
            target = target.plus({ days: 1 });
        }
        
        return target;
    }
    
    return null;
}

/**
 * Format a date to Discord timestamp
 */
export function formatDiscordTimestamp(date: Date, format: 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R' = 'f'): string {
    const unixTimestamp = Math.floor(date.getTime() / 1000);
    return `<t:${unixTimestamp}:${format}>`;
}

/**
 * Format a duration in minutes to a human-readable string
 */
export function formatDuration(minutes: number): string {
    if (minutes < 60) {
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    
    return `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
}

/**
 * Format a date range
 */
export function formatDateRange(start: Date, end?: Date, timezone: string = 'UTC'): string {
    const startDt = DateTime.fromJSDate(start).setZone(timezone);
    
    if (!end) {
        return startDt.toFormat('MMMM d, yyyy h:mm a');
    }
    
    const endDt = DateTime.fromJSDate(end).setZone(timezone);
    
    // Same day
    if (startDt.hasSame(endDt, 'day')) {
        return `${startDt.toFormat('MMMM d, yyyy h:mm a')} - ${endDt.toFormat('h:mm a')}`;
    }
    
    // Different days
    return `${startDt.toFormat('MMM d, h:mm a')} - ${endDt.toFormat('MMM d, h:mm a')}`;
}

/**
 * Get relative time string (e.g., "in 2 hours", "2 hours ago")
 */
export function getRelativeTimeString(date: Date): string {
    return formatDiscordTimestamp(date, 'R');
}

/**
 * Check if a date is in the past
 */
export function isInThePast(date: Date): boolean {
    return date.getTime() < Date.now();
}

/**
 * Add minutes to a date
 */
export function addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60000);
}

/**
 * Get the next occurrence of a specific day and time
 */
export function getNextOccurrence(
    dayOfWeek: number, // 0 = Sunday, 1 = Monday, etc.
    hour: number,
    minute: number,
    timezone: string = 'UTC'
): Date {
    const now = DateTime.now().setZone(timezone);
    // Note: luxon weekday is 1-7 (Monday-Sunday), but we need 0-6 for typical JS usage
    const luxonWeekday = dayOfWeek === 0 ? 7 : dayOfWeek;
    let target = now.set({ weekday: luxonWeekday as any, hour, minute, second: 0, millisecond: 0 });
    
    if (target <= now) {
        target = target.plus({ weeks: 1 });
    }
    
    return target.toJSDate();
}
