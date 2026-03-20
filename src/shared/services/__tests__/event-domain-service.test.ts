import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    dbMock,
    dbSelectWhereMock,
    dbInsertValuesMock,
    dbInsertReturningMock,
    dbUpdateSetMock,
    dbUpdateWhereMock,
    dbUpdateReturningMock,
    dbDeleteWhereMock,
    mockWebhookTrigger,
} = vi.hoisted(() => {
    const dbInsertReturningMock = vi.fn();
    const dbInsertValuesMock = vi.fn().mockReturnValue({ returning: dbInsertReturningMock });

    const dbUpdateReturningMock = vi.fn();
    const dbUpdateWhereMock = vi.fn().mockReturnValue({ returning: dbUpdateReturningMock });
    const dbUpdateSetMock = vi.fn().mockReturnValue({ where: dbUpdateWhereMock });

    const dbDeleteWhereMock = vi.fn();

    const dbSelectWhereMock = vi.fn();
    const dbSelectFromMock = vi.fn().mockReturnValue({ where: dbSelectWhereMock });

    const dbMock = {
        select: vi.fn().mockReturnValue({ from: dbSelectFromMock }),
        update: vi.fn().mockReturnValue({ set: dbUpdateSetMock }),
        insert: vi.fn().mockReturnValue({ values: dbInsertValuesMock }),
        delete: vi.fn().mockReturnValue({ where: dbDeleteWhereMock }),
    };

    const mockWebhookTrigger = vi.fn().mockResolvedValue(undefined);

    return {
        dbMock, dbSelectWhereMock,
        dbInsertValuesMock, dbInsertReturningMock,
        dbUpdateSetMock, dbUpdateWhereMock, dbUpdateReturningMock,
        dbDeleteWhereMock, mockWebhookTrigger,
    };
});

vi.mock('@shared/database/client', () => ({ db: dbMock }));
vi.mock('@shared/database/schema', () => ({ event: {}, eventPollSettings: {} }));
// Correct path from src/shared/services/__tests__/ to src/bot/services/webhook-service
vi.mock('../../../bot/services/webhook-service', () => ({
    webhookService: { triggerEvent: mockWebhookTrigger },
}));

const fetchMock = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('fetch', fetchMock);

import { eventService } from '../event-domain-service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEventRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 'event-1',
        guildId: 'guild-1',
        creatorId: 'user-1',
        channelId: 'channel-1',
        locationChannelId: null,
        title: 'Test Event',
        description: null,
        color: null,
        location: null,
        imageUrl: null,
        startTime: new Date('2026-04-01T18:00:00Z'),
        endTime: null,
        durationMinutes: 60,
        maxAttendees: null,
        enableWaitlist: false,
        mentionRoleIds: null,
        mentionOnCreate: false,
        mentionOnStart: false,
        requiredRoleIds: null,
        blockedRoleIds: null,
        attendeeRoleId: null,
        repeatFrequency: 'NONE',
        repeatUntil: null,
        mirrorToDiscord: false,
        discordScheduledEventId: null,
        messageId: null,
        parentEventId: null,
        status: 'SCHEDULED',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

function makeCreateData(overrides: Record<string, unknown> = {}) {
    return {
        guildId: 'guild-1',
        creatorId: 'user-1',
        channelId: 'channel-1',
        title: 'Test Event',
        startTime: new Date('2026-04-01T18:00:00Z'),
        ...overrides,
    };
}

/** Re-wire the chainable mock stubs. Use vi.resetAllMocks() first to get a clean slate. */
function restoreChains() {
    // select chain: .select().from().where() → Promise
    const dbSelectFromMock = vi.fn().mockReturnValue({ where: dbSelectWhereMock });
    dbMock.select.mockReturnValue({ from: dbSelectFromMock });

    // insert chain: .insert().values().returning() → Promise
    dbInsertValuesMock.mockReturnValue({ returning: dbInsertReturningMock });
    dbMock.insert.mockReturnValue({ values: dbInsertValuesMock });

    // update chain: .update().set().where().returning() → Promise
    dbUpdateWhereMock.mockReturnValue({ returning: dbUpdateReturningMock });
    dbUpdateSetMock.mockReturnValue({ where: dbUpdateWhereMock });
    dbMock.update.mockReturnValue({ set: dbUpdateSetMock });

    // delete chain: .delete().where() → Promise
    dbMock.delete.mockReturnValue({ where: dbDeleteWhereMock });

    mockWebhookTrigger.mockResolvedValue(undefined);
    fetchMock.mockResolvedValue({ ok: true });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('eventService.createEvent', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        restoreChains();
    });

    it('inserts a new event and returns it', async () => {
        const created = makeEventRow();
        dbSelectWhereMock.mockResolvedValueOnce([]); // settings lookup
        dbInsertReturningMock.mockResolvedValueOnce([created]);

        const result = await eventService.createEvent(makeCreateData());
        expect(dbMock.insert).toHaveBeenCalled();
        expect(result).toEqual(created);
    });

    it('reads mirrorToDiscord from guild settings when not explicitly provided', async () => {
        dbSelectWhereMock.mockResolvedValueOnce([{ mirrorToDiscordEvents: false }]);
        dbInsertReturningMock.mockResolvedValueOnce([makeEventRow({ mirrorToDiscord: false })]);

        await eventService.createEvent(makeCreateData());

        const insertedData = dbInsertValuesMock.mock.calls[0][0];
        expect(insertedData.mirrorToDiscord).toBe(false);
    });

    it('uses explicitly provided mirrorToDiscord without querying settings', async () => {
        dbInsertReturningMock.mockResolvedValueOnce([makeEventRow({ mirrorToDiscord: true })]);

        await eventService.createEvent(makeCreateData({ mirrorToDiscord: true }));

        expect(dbMock.select).not.toHaveBeenCalled();
    });

    it('derives durationMinutes from endTime when durationMinutes is absent', async () => {
        const start = new Date('2026-04-01T18:00:00Z');
        const end = new Date('2026-04-01T19:30:00Z'); // 90 minutes
        dbInsertReturningMock.mockResolvedValueOnce([makeEventRow({ durationMinutes: 90 })]);

        await eventService.createEvent(makeCreateData({ mirrorToDiscord: true, startTime: start, endTime: end }));

        const insertedData = dbInsertValuesMock.mock.calls[0][0];
        expect(insertedData.durationMinutes).toBe(90);
    });

    it('defaults durationMinutes to 60 when neither endTime nor durationMinutes is provided', async () => {
        dbInsertReturningMock.mockResolvedValueOnce([makeEventRow()]);

        await eventService.createEvent(makeCreateData({ mirrorToDiscord: true }));

        const insertedData = dbInsertValuesMock.mock.calls[0][0];
        expect(insertedData.durationMinutes).toBe(60);
    });

    it('fires a webhook after successful creation', async () => {
        dbInsertReturningMock.mockResolvedValueOnce([makeEventRow()]);

        await eventService.createEvent(makeCreateData({ mirrorToDiscord: true }));

        expect(mockWebhookTrigger).toHaveBeenCalledWith('guild-1', 'event.created', expect.objectContaining({
            eventId: 'event-1',
            title: 'Test Event',
        }));
    });
});

describe('eventService.getEventById', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        restoreChains();
    });

    it('returns the event when found', async () => {
        dbSelectWhereMock.mockResolvedValueOnce([makeEventRow()]);
        const result = await eventService.getEventById('event-1');
        expect(result?.id).toBe('event-1');
    });

    it('returns undefined when not found', async () => {
        dbSelectWhereMock.mockResolvedValueOnce([]);
        const result = await eventService.getEventById('missing');
        expect(result).toBeUndefined();
    });
});

describe('eventService.updateEvent', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        restoreChains();
    });

    it('returns undefined when the event does not exist', async () => {
        dbSelectWhereMock.mockResolvedValueOnce([]);
        const result = await eventService.updateEvent('missing', { title: 'New Title' });
        expect(result).toBeUndefined();
    });

    it('updates and returns the event', async () => {
        dbSelectWhereMock.mockResolvedValueOnce([makeEventRow()]);
        dbUpdateReturningMock.mockResolvedValueOnce([makeEventRow({ title: 'Updated' })]);

        const result = await eventService.updateEvent('event-1', { title: 'Updated' });
        expect(result?.title).toBe('Updated');
    });

    it('fires a webhook after a successful update', async () => {
        dbSelectWhereMock.mockResolvedValueOnce([makeEventRow()]);
        dbUpdateReturningMock.mockResolvedValueOnce([makeEventRow({ title: 'Updated' })]);

        await eventService.updateEvent('event-1', { title: 'Updated' });

        expect(mockWebhookTrigger).toHaveBeenCalledWith('guild-1', 'event.updated', expect.any(Object));
    });

    it('deletes the Discord scheduled event when mirrorToDiscord is turned off', async () => {
        const existing = makeEventRow({ mirrorToDiscord: true, discordScheduledEventId: 'discord-event-1' });
        const updated = makeEventRow({ mirrorToDiscord: false, discordScheduledEventId: null });

        dbSelectWhereMock.mockResolvedValueOnce([existing]);
        dbUpdateReturningMock.mockResolvedValueOnce([updated]);
        // The second db.update().set().where() (no .returning()) just needs to be awaitable.
        // The default mockReturnValue({ returning: fn }) makes where() return a non-Promise
        // object which `await` resolves fine — no extra mock needed.

        process.env.DISCORD_TOKEN = 'test-token';
        await eventService.updateEvent('event-1', { mirrorToDiscord: false });
        delete process.env.DISCORD_TOKEN;

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('scheduled-events/discord-event-1'),
            expect.objectContaining({ method: 'DELETE' })
        );
    });
});

describe('eventService.deleteEvent', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        restoreChains();
    });

    it('returns false when the event does not exist', async () => {
        dbSelectWhereMock.mockResolvedValueOnce([]);
        expect(await eventService.deleteEvent('missing')).toBe(false);
    });

    it('deletes the event and returns true', async () => {
        dbSelectWhereMock.mockResolvedValueOnce([makeEventRow()]);
        dbDeleteWhereMock.mockResolvedValueOnce({ rowCount: 1 });

        expect(await eventService.deleteEvent('event-1')).toBe(true);
    });

    it('fires a webhook after deletion', async () => {
        dbSelectWhereMock.mockResolvedValueOnce([makeEventRow()]);
        dbDeleteWhereMock.mockResolvedValueOnce({ rowCount: 1 });

        await eventService.deleteEvent('event-1');

        expect(mockWebhookTrigger).toHaveBeenCalledWith('guild-1', 'event.deleted', expect.objectContaining({
            eventId: 'event-1',
        }));
    });

    it('calls Discord REST to delete the message when messageId is set', async () => {
        process.env.DISCORD_TOKEN = 'test-token';
        dbSelectWhereMock.mockResolvedValueOnce([makeEventRow({ messageId: 'msg-123' })]);
        dbDeleteWhereMock.mockResolvedValueOnce({ rowCount: 1 });

        await eventService.deleteEvent('event-1');
        delete process.env.DISCORD_TOKEN;

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('messages/msg-123'),
            expect.objectContaining({ method: 'DELETE' })
        );
    });

    it('calls Discord REST to delete the scheduled event when one is mirrored', async () => {
        process.env.DISCORD_TOKEN = 'test-token';
        dbSelectWhereMock.mockResolvedValueOnce([
            makeEventRow({ mirrorToDiscord: true, discordScheduledEventId: 'sched-1' }),
        ]);
        dbDeleteWhereMock.mockResolvedValueOnce({ rowCount: 1 });

        await eventService.deleteEvent('event-1');
        delete process.env.DISCORD_TOKEN;

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('scheduled-events/sched-1'),
            expect.objectContaining({ method: 'DELETE' })
        );
    });
});

describe('eventService.createRepeatingEvents', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        restoreChains();
    });

    it('returns an empty array when repeatFrequency is NONE', async () => {
        const parent = makeEventRow({ repeatFrequency: 'NONE', repeatUntil: null });
        expect(await eventService.createRepeatingEvents(parent as any)).toEqual([]);
        expect(dbMock.insert).not.toHaveBeenCalled();
    });

    it('returns an empty array when repeatUntil is not set', async () => {
        const parent = makeEventRow({ repeatFrequency: 'WEEKLY', repeatUntil: null });
        expect(await eventService.createRepeatingEvents(parent as any)).toEqual([]);
    });

    it('creates DAILY recurrences up to repeatUntil', async () => {
        const start = new Date('2026-04-01T18:00:00Z');
        const until = new Date('2026-04-04T00:00:00Z'); // 3 days → 2 occurrences before until
        const parent = makeEventRow({ repeatFrequency: 'DAILY', startTime: start, repeatUntil: until });

        dbInsertReturningMock
            .mockResolvedValueOnce([makeEventRow({ id: 'child-1' })])
            .mockResolvedValueOnce([makeEventRow({ id: 'child-2' })]);

        const result = await eventService.createRepeatingEvents(parent as any);
        expect(result).toHaveLength(2);
        expect(dbMock.insert).toHaveBeenCalledTimes(2);
    });

    it('sets mirrorToDiscord=false and parentEventId on children', async () => {
        const start = new Date('2026-04-01T18:00:00Z');
        // until must be after the first child occurrence (2026-04-08T18:00:00Z)
        const until = new Date('2026-04-09T00:00:00Z');
        const parent = makeEventRow({
            id: 'parent-1',
            repeatFrequency: 'WEEKLY',
            startTime: start,
            repeatUntil: until,
            mirrorToDiscord: true,
        });

        dbInsertReturningMock.mockResolvedValueOnce([makeEventRow({ id: 'child-1' })]);

        await eventService.createRepeatingEvents(parent as any);

        const insertedValues = dbInsertValuesMock.mock.calls[0][0];
        expect(insertedValues.mirrorToDiscord).toBe(false);
        expect(insertedValues.parentEventId).toBe('parent-1');
    });
});

describe('eventService.setEventStatus', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        restoreChains();
    });

    it('updates the status and returns the updated event', async () => {
        dbUpdateReturningMock.mockResolvedValueOnce([makeEventRow({ status: 'ACTIVE' })]);
        const result = await eventService.setEventStatus('event-1', 'ACTIVE');
        expect(result?.status).toBe('ACTIVE');
    });

    it('returns undefined when the event is not found', async () => {
        dbUpdateReturningMock.mockResolvedValueOnce([]);
        const result = await eventService.setEventStatus('missing', 'CANCELLED');
        expect(result).toBeUndefined();
    });
});
