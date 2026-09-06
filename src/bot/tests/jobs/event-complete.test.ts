import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEventService = {
    getActiveEvents: vi.fn(),
    markEventAsCompleted: vi.fn(),
};

const mockIsModuleEnabled = vi.fn();
const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
};

vi.mock('../../services/event-service', () => ({
    eventService: mockEventService,
}));

vi.mock('@shared/modules/state', () => ({
    isModuleEnabled: mockIsModuleEnabled,
}));

vi.mock('../../utils/logger', () => ({
    default: mockLogger,
}));

describe('event-complete job', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('marks active events complete when explicit end time has passed', async () => {
        const { execute } = await import('../../jobs/event-complete');

        const now = Date.now();
        mockEventService.getActiveEvents.mockResolvedValue([
            {
                id: 'event-ended',
                guildId: 'guild-1',
                startTime: new Date(now - 3_600_000),
                endTime: new Date(now - 60_000),
                durationMinutes: 30,
            },
        ]);
        mockIsModuleEnabled.mockResolvedValue(true);

        await execute({} as any);

        expect(mockEventService.markEventAsCompleted).toHaveBeenCalledWith('event-ended');
    });

    it('uses duration fallback and default 60 minutes to complete overdue events', async () => {
        const { execute } = await import('../../jobs/event-complete');

        const now = Date.now();
        mockEventService.getActiveEvents.mockResolvedValue([
            {
                id: 'event-duration',
                guildId: 'guild-1',
                startTime: new Date(now - 90 * 60_000),
                endTime: null,
                durationMinutes: 30,
            },
            {
                id: 'event-default',
                guildId: 'guild-1',
                startTime: new Date(now - 120 * 60_000),
                endTime: null,
                durationMinutes: null,
            },
        ]);
        mockIsModuleEnabled.mockResolvedValue(true);

        await execute({} as any);

        expect(mockEventService.markEventAsCompleted).toHaveBeenCalledWith('event-duration');
        expect(mockEventService.markEventAsCompleted).toHaveBeenCalledWith('event-default');
    });

    it('does not complete future events or disabled-module events', async () => {
        const { execute } = await import('../../jobs/event-complete');

        const now = Date.now();
        mockEventService.getActiveEvents.mockResolvedValue([
            {
                id: 'event-future',
                guildId: 'guild-enabled',
                startTime: new Date(now - 15 * 60_000),
                endTime: null,
                durationMinutes: 45,
            },
            {
                id: 'event-disabled',
                guildId: 'guild-disabled',
                startTime: new Date(now - 3_600_000),
                endTime: new Date(now - 1_000),
                durationMinutes: null,
            },
        ]);
        mockIsModuleEnabled.mockImplementation(async (guildId: string) => guildId !== 'guild-disabled');

        await execute({} as any);

        expect(mockEventService.markEventAsCompleted).not.toHaveBeenCalledWith('event-future');
        expect(mockEventService.markEventAsCompleted).not.toHaveBeenCalledWith('event-disabled');
        expect(mockEventService.markEventAsCompleted).toHaveBeenCalledTimes(0);
    });
});
