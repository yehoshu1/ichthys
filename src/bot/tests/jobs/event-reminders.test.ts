import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEventService = {
    getPendingReminders: vi.fn(),
    markReminderSent: vi.fn(),
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

describe('event-reminders job', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sends DM reminder embed and marks reminder as sent', async () => {
        const { execute } = await import('../../jobs/event-reminders');

        const send = vi.fn().mockResolvedValue(undefined);
        const usersFetch = vi.fn().mockResolvedValue({ send });
        const client = {
            users: {
                fetch: usersFetch,
            },
        } as any;

        const startTime = new Date(Date.now() + 30 * 60_000);
        mockEventService.getPendingReminders.mockResolvedValue([
            {
                reminder: {
                    id: 'rem-1',
                    userId: 'user-1',
                },
                event: {
                    id: 'event-1',
                    guildId: 'guild-1',
                    title: 'Weekly Prayer',
                    startTime,
                    location: null,
                    locationChannelId: null,
                    channelId: 'channel-1',
                    description: 'Join us in prayer',
                },
            },
        ]);
        mockIsModuleEnabled.mockResolvedValue(true);

        await execute(client);

        expect(usersFetch).toHaveBeenCalledWith('user-1');
        expect(send).toHaveBeenCalledTimes(1);
        expect(mockEventService.markReminderSent).toHaveBeenCalledWith('rem-1');

        const payload = send.mock.calls[0][0];
        const embedJson = payload.embeds[0].toJSON();
        expect(embedJson.title).toBe('⏰ Event Reminder');
        expect(embedJson.fields?.some((f: any) => f.name === 'Event' && f.value === 'Weekly Prayer')).toBe(true);
        expect(embedJson.fields?.some((f: any) => f.name === 'Location' && f.value === '<#channel-1>')).toBe(true);
    });

    it('marks reminder sent without DM when module is disabled', async () => {
        const { execute } = await import('../../jobs/event-reminders');

        const usersFetch = vi.fn();
        const client = {
            users: {
                fetch: usersFetch,
            },
        } as any;

        mockEventService.getPendingReminders.mockResolvedValue([
            {
                reminder: {
                    id: 'rem-disabled',
                    userId: 'user-1',
                },
                event: {
                    id: 'event-disabled',
                    guildId: 'guild-1',
                    title: 'Disabled Event',
                    startTime: new Date(Date.now() + 30 * 60_000),
                    location: null,
                    locationChannelId: null,
                    channelId: 'channel-1',
                    description: null,
                },
            },
        ]);
        mockIsModuleEnabled.mockResolvedValue(false);

        await execute(client);

        expect(usersFetch).not.toHaveBeenCalled();
        expect(mockEventService.markReminderSent).toHaveBeenCalledWith('rem-disabled');
    });

    it('marks reminder sent when DM send fails', async () => {
        const { execute } = await import('../../jobs/event-reminders');

        const send = vi.fn().mockRejectedValue(new Error('cannot DM user'));
        const usersFetch = vi.fn().mockResolvedValue({ send });
        const client = {
            users: {
                fetch: usersFetch,
            },
        } as any;

        mockEventService.getPendingReminders.mockResolvedValue([
            {
                reminder: {
                    id: 'rem-fail',
                    userId: 'user-2',
                },
                event: {
                    id: 'event-fail',
                    guildId: 'guild-1',
                    title: 'Failed DM Event',
                    startTime: new Date(Date.now() + 15 * 60_000),
                    location: 'Main Hall',
                    locationChannelId: null,
                    channelId: 'channel-1',
                    description: null,
                },
            },
        ]);
        mockIsModuleEnabled.mockResolvedValue(true);

        await execute(client);

        expect(send).toHaveBeenCalledTimes(1);
        expect(mockEventService.markReminderSent).toHaveBeenCalledWith('rem-fail');
        expect(mockLogger.warn).toHaveBeenCalled();
    });
});
