import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    addMinutes,
    formatDateRange,
    formatDiscordTimestamp,
    formatDuration,
    isInThePast,
    parseNaturalLanguageDate,
} from '../date-parser';

// Reference: 2026-03-16T10:00:00.000Z — a Monday
const FIXED_NOW = new Date('2026-03-16T10:00:00.000Z');

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
    vi.useRealTimers();
});

// ── parseNaturalLanguageDate ─────────────────────────────────────────────────

describe('parseNaturalLanguageDate', () => {
    describe('ISO / SQL formats', () => {
        it('parses an ISO 8601 string with timezone', () => {
            const result = parseNaturalLanguageDate('2026-03-20T18:00:00Z', 'UTC');
            expect(result).toBeInstanceOf(Date);
            expect(result!.toISOString()).toBe('2026-03-20T18:00:00.000Z');
        });

        it('parses a SQL date-time string', () => {
            const result = parseNaturalLanguageDate('2026-03-20 18:00:00', 'UTC');
            expect(result).toBeInstanceOf(Date);
            // date must be 2026-03-20 at 18:00 UTC
            expect(result!.getUTCFullYear()).toBe(2026);
            expect(result!.getUTCMonth()).toBe(2); // 0-indexed
            expect(result!.getUTCDate()).toBe(20);
            expect(result!.getUTCHours()).toBe(18);
        });
    });

    describe('relative time — "in X unit"', () => {
        it('handles "in 3 hours"', () => {
            const result = parseNaturalLanguageDate('in 3 hours', 'UTC');
            expect(result).toBeInstanceOf(Date);
            expect(result!.toISOString()).toBe('2026-03-16T13:00:00.000Z');
        });

        it('handles "in 1 hour"', () => {
            const result = parseNaturalLanguageDate('in 1 hour', 'UTC');
            expect(result!.toISOString()).toBe('2026-03-16T11:00:00.000Z');
        });

        it('handles "in 30 minutes"', () => {
            const result = parseNaturalLanguageDate('in 30 minutes', 'UTC');
            expect(result!.toISOString()).toBe('2026-03-16T10:30:00.000Z');
        });

        it('handles "in 1 minute"', () => {
            const result = parseNaturalLanguageDate('in 1 minute', 'UTC');
            expect(result!.toISOString()).toBe('2026-03-16T10:01:00.000Z');
        });

        it('handles "in 2 days"', () => {
            const result = parseNaturalLanguageDate('in 2 days', 'UTC');
            expect(result!.toISOString()).toBe('2026-03-18T10:00:00.000Z');
        });

        it('handles "in 1 week"', () => {
            const result = parseNaturalLanguageDate('in 1 week', 'UTC');
            expect(result!.toISOString()).toBe('2026-03-23T10:00:00.000Z');
        });

        it('handles "in 2 weeks"', () => {
            const result = parseNaturalLanguageDate('in 2 weeks', 'UTC');
            expect(result!.toISOString()).toBe('2026-03-30T10:00:00.000Z');
        });

        it('handles "in 1 month"', () => {
            const result = parseNaturalLanguageDate('in 1 month', 'UTC');
            expect(result!.getUTCMonth()).toBe(3); // April
        });
    });

    describe('relative time — "X unit from now"', () => {
        it('handles "2 hours from now"', () => {
            const result = parseNaturalLanguageDate('2 hours from now', 'UTC');
            expect(result!.toISOString()).toBe('2026-03-16T12:00:00.000Z');
        });

        it('handles "3 days from now"', () => {
            const result = parseNaturalLanguageDate('3 days from now', 'UTC');
            expect(result!.toISOString()).toBe('2026-03-19T10:00:00.000Z');
        });

        it('handles "1 week from now"', () => {
            const result = parseNaturalLanguageDate('1 week from now', 'UTC');
            expect(result!.toISOString()).toBe('2026-03-23T10:00:00.000Z');
        });
    });

    describe('day-of-week references', () => {
        // Reference day: Monday 2026-03-16 (Luxon weekday=1)

        it('returns the upcoming Friday at noon when today is Monday', () => {
            // Friday (targetDay=5 in sunday-indexed array): daysToAdd = 5-1 = 4
            const result = parseNaturalLanguageDate('friday', 'UTC');
            expect(result!.getUTCDay()).toBe(5); // 5 = Friday
            expect(result!.getUTCHours()).toBe(12);
        });

        it('handles "next monday" (forces 7 days ahead)', () => {
            const result = parseNaturalLanguageDate('next monday', 'UTC');
            // Should be 7 days later since isNext forces +7
            const expectedDate = new Date('2026-03-23T12:00:00.000Z');
            expect(result!.getUTCDate()).toBe(expectedDate.getUTCDate());
        });

        it('parses short day names like "fri"', () => {
            const result = parseNaturalLanguageDate('fri', 'UTC');
            expect(result!.getUTCDay()).toBe(5);
        });

        it('parses day with time: "friday at 3pm"', () => {
            const result = parseNaturalLanguageDate('friday at 3pm', 'UTC');
            expect(result!.getUTCDay()).toBe(5);
            expect(result!.getUTCHours()).toBe(15);
            expect(result!.getUTCMinutes()).toBe(0);
        });

        it('parses day with time including minutes: "friday at 2:30pm"', () => {
            const result = parseNaturalLanguageDate('friday at 2:30pm', 'UTC');
            expect(result!.getUTCDay()).toBe(5);
            expect(result!.getUTCHours()).toBe(14);
            expect(result!.getUTCMinutes()).toBe(30);
        });

        it('handles 12am correctly (midnight) on a day reference', () => {
            const result = parseNaturalLanguageDate('friday at 12am', 'UTC');
            expect(result!.getUTCDay()).toBe(5);
            expect(result!.getUTCHours()).toBe(0);
        });

        it('handles 12pm correctly (noon) on a day reference', () => {
            const result = parseNaturalLanguageDate('friday at 12pm', 'UTC');
            expect(result!.getUTCDay()).toBe(5);
            expect(result!.getUTCHours()).toBe(12);
        });
    });

    describe('"today" / "tomorrow" / special keywords', () => {
        it('handles "tomorrow" — next day at noon', () => {
            const result = parseNaturalLanguageDate('tomorrow', 'UTC');
            expect(result!.getUTCDate()).toBe(17);
            expect(result!.getUTCHours()).toBe(12);
        });

        it('handles "tomorrow at 6pm"', () => {
            const result = parseNaturalLanguageDate('tomorrow at 6pm', 'UTC');
            expect(result!.getUTCDate()).toBe(17);
            expect(result!.getUTCHours()).toBe(18);
        });

        it('handles "today at 5pm"', () => {
            const result = parseNaturalLanguageDate('today at 5pm', 'UTC');
            expect(result!.getUTCDate()).toBe(16);
            expect(result!.getUTCHours()).toBe(17);
        });

        it('handles "tonight" — same day at 20:00', () => {
            const result = parseNaturalLanguageDate('tonight', 'UTC');
            expect(result!.getUTCDate()).toBe(16);
            expect(result!.getUTCHours()).toBe(20);
        });

        it('handles "noon" — same day at 12:00', () => {
            const result = parseNaturalLanguageDate('noon', 'UTC');
            expect(result!.getUTCHours()).toBe(12);
        });

        it('handles "midnight" — same day at 00:00', () => {
            const result = parseNaturalLanguageDate('midnight', 'UTC');
            expect(result!.getUTCHours()).toBe(0);
        });
    });

    describe('time-only (chrono-like) patterns', () => {
        it('parses "6pm" — same day since 18:00 > 10:00', () => {
            const result = parseNaturalLanguageDate('6pm', 'UTC');
            expect(result!.getUTCDate()).toBe(16);
            expect(result!.getUTCHours()).toBe(18);
        });

        it('parses "8am" — tomorrow since 08:00 < 10:00', () => {
            const result = parseNaturalLanguageDate('8am', 'UTC');
            expect(result!.getUTCDate()).toBe(17); // next day
            expect(result!.getUTCHours()).toBe(8);
        });

        it('parses "14:00" (24-hour format)', () => {
            const result = parseNaturalLanguageDate('14:00', 'UTC');
            expect(result!.getUTCDate()).toBe(16);
            expect(result!.getUTCHours()).toBe(14);
        });

        it('parses "6:30pm"', () => {
            const result = parseNaturalLanguageDate('6:30pm', 'UTC');
            expect(result!.getUTCHours()).toBe(18);
            expect(result!.getUTCMinutes()).toBe(30);
        });
    });

    it('returns null for completely unrecognisable input', () => {
        expect(parseNaturalLanguageDate('not a date at all $$%%', 'UTC')).toBeNull();
    });
});

// ── formatDiscordTimestamp ───────────────────────────────────────────────────

describe('formatDiscordTimestamp', () => {
    it('defaults to "f" format', () => {
        const date = new Date('2026-03-16T10:00:00.000Z');
        const unix = Math.floor(date.getTime() / 1000);
        expect(formatDiscordTimestamp(date)).toBe(`<t:${unix}:f>`);
    });

    it('supports the "R" (relative) format', () => {
        const date = new Date('2026-03-16T10:00:00.000Z');
        const unix = Math.floor(date.getTime() / 1000);
        expect(formatDiscordTimestamp(date, 'R')).toBe(`<t:${unix}:R>`);
    });

    it('uses integer Unix timestamps', () => {
        const date = new Date('2026-03-16T10:00:00.500Z'); // half-second
        const result = formatDiscordTimestamp(date, 't');
        expect(result).not.toMatch(/\./); // no decimal
    });
});

// ── formatDuration ───────────────────────────────────────────────────────────

describe('formatDuration', () => {
    it('formats 1 minute correctly (singular)', () => {
        expect(formatDuration(1)).toBe('1 minute');
    });

    it('formats multiple minutes', () => {
        expect(formatDuration(45)).toBe('45 minutes');
    });

    it('formats exactly 1 hour (singular, no minutes)', () => {
        expect(formatDuration(60)).toBe('1 hour');
    });

    it('formats multiple hours (no minutes)', () => {
        expect(formatDuration(120)).toBe('2 hours');
    });

    it('formats hours and minutes', () => {
        expect(formatDuration(90)).toBe('1 hour 30 minutes');
    });

    it('formats hours and 1 minute (singular minute)', () => {
        expect(formatDuration(61)).toBe('1 hour 1 minute');
    });

    it('formats 2 hours and 1 minute', () => {
        expect(formatDuration(121)).toBe('2 hours 1 minute');
    });
});

// ── formatDateRange ──────────────────────────────────────────────────────────

describe('formatDateRange', () => {
    it('formats a single start date when no end is provided', () => {
        const start = new Date('2026-03-20T18:00:00.000Z');
        const result = formatDateRange(start, undefined, 'UTC');
        expect(result).toMatch(/March 20, 2026/);
        expect(result).toMatch(/6:00 PM/);
    });

    it('formats same-day range with shared date prefix', () => {
        const start = new Date('2026-03-20T18:00:00.000Z');
        const end = new Date('2026-03-20T20:00:00.000Z');
        const result = formatDateRange(start, end, 'UTC');
        // Same day: "March 20, 2026 6:00 PM - 8:00 PM"
        expect(result).toMatch(/March 20, 2026/);
        expect(result).toMatch(/8:00 PM/);
    });

    it('formats multi-day range with both dates shown', () => {
        const start = new Date('2026-03-20T18:00:00.000Z');
        const end = new Date('2026-03-21T10:00:00.000Z');
        const result = formatDateRange(start, end, 'UTC');
        expect(result).toMatch(/Mar 20/);
        expect(result).toMatch(/Mar 21/);
    });
});

// ── isInThePast ──────────────────────────────────────────────────────────────

describe('isInThePast', () => {
    it('returns true for a date before now', () => {
        const past = new Date(FIXED_NOW.getTime() - 1000);
        expect(isInThePast(past)).toBe(true);
    });

    it('returns false for a date in the future', () => {
        const future = new Date(FIXED_NOW.getTime() + 1000);
        expect(isInThePast(future)).toBe(false);
    });
});

// ── addMinutes ───────────────────────────────────────────────────────────────

describe('addMinutes', () => {
    it('adds the correct number of milliseconds', () => {
        const base = new Date('2026-03-16T10:00:00.000Z');
        const result = addMinutes(base, 90);
        expect(result.toISOString()).toBe('2026-03-16T11:30:00.000Z');
    });

    it('handles 0 minutes', () => {
        const base = new Date('2026-03-16T10:00:00.000Z');
        expect(addMinutes(base, 0).getTime()).toBe(base.getTime());
    });
});
