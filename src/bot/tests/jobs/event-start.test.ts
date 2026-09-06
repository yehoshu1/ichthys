import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEventService = {
    getEventsStartingBetween: vi.fn(),
    markEventAsStarted: vi.fn(),
    getRsvpsByEvent: vi.fn(),
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

describe('event-start job', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sends start embed with mention roles, attendees field, and assigns attendee role', async () => {
        const { execute } = await import('../../jobs/event-start');

        const send = vi.fn().mockResolvedValue(undefined);
        const fetchedMemberRoleAdd = vi.fn().mockResolvedValue(undefined);
        const channel = {
            id: 'channel-1',
            isTextBased: () => true,
            send,
        };

        const guild = {
            id: 'guild-1',
            name: 'Guild One',
            channels: {
                cache: new Map<string, unknown>(),
                fetch: vi.fn().mockResolvedValue(channel),
            },
            members: {
                fetch: vi.fn().mockResolvedValue({
                    roles: {
                        add: fetchedMemberRoleAdd,
                    },
                }),
            },
        };

        const client = {
            guilds: {
                cache: new Map<string, unknown>([['guild-1', guild]]),
            },
        } as any;

        const startTime = new Date('2026-03-11T16:57:00.000Z');
        mockEventService.getEventsStartingBetween.mockResolvedValue([
            {
                id: 'event-1',
                guildId: 'guild-1',
                channelId: 'channel-1',
                title: 'Even',
                startTime,
                location: null,
                mentionOnStart: true,
                mentionRoleIds: ['role-a', 'role-a', 'role-b'],
                attendeeRoleId: 'attendee-role',
            },
        ]);
        mockEventService.getRsvpsByEvent.mockResolvedValue([
            { userId: 'user-1' },
            { userId: 'user-2' },
        ]);
        mockIsModuleEnabled.mockResolvedValue(true);

        await execute(client);

        expect(guild.channels.fetch).toHaveBeenCalledWith('channel-1');
        expect(mockEventService.markEventAsStarted).toHaveBeenCalledWith('event-1');
        expect(send).toHaveBeenCalledTimes(1);

        const payload = send.mock.calls[0][0];
        expect(payload.content).toBe('<@&role-a> <@&role-b>');
        expect(payload.allowedMentions).toEqual({ roles: ['role-a', 'role-b'] });
        expect(payload.embeds).toHaveLength(1);

        const embedJson = payload.embeds[0].toJSON();
        expect(embedJson.title).toBe('🎉 Event Starting Now!');
        expect(embedJson.description).toBe('Even is starting!');
        expect(embedJson.fields?.some((f: any) => f.name === 'Event' && f.value === 'Even')).toBe(true);
        expect(embedJson.fields?.some((f: any) => f.name === 'Attendees (2)' && f.value.includes('<@user-1>'))).toBe(true);

        expect(guild.members.fetch).toHaveBeenCalledTimes(2);
        expect(fetchedMemberRoleAdd).toHaveBeenCalledWith('attendee-role');
    });

    it('skips events when events module is disabled', async () => {
        const { execute } = await import('../../jobs/event-start');

        const send = vi.fn();
        const channel = {
            id: 'channel-1',
            isTextBased: () => true,
            send,
        };
        const guild = {
            id: 'guild-1',
            channels: {
                cache: new Map<string, unknown>([['channel-1', channel]]),
                fetch: vi.fn(),
            },
            members: {
                fetch: vi.fn(),
            },
        };

        const client = {
            guilds: {
                cache: new Map<string, unknown>([['guild-1', guild]]),
            },
        } as any;

        mockEventService.getEventsStartingBetween.mockResolvedValue([
            {
                id: 'event-1',
                guildId: 'guild-1',
                channelId: 'channel-1',
                title: 'Skip Me',
                startTime: new Date(),
                mentionOnStart: false,
                mentionRoleIds: null,
                attendeeRoleId: null,
                location: null,
            },
        ]);
        mockIsModuleEnabled.mockResolvedValue(false);

        await execute(client);

        expect(mockEventService.markEventAsStarted).not.toHaveBeenCalled();
        expect(send).not.toHaveBeenCalled();
    });

    it('sends embed without role mentions when mentionOnStart is disabled', async () => {
        const { execute } = await import('../../jobs/event-start');

        const send = vi.fn().mockResolvedValue(undefined);
        const channel = {
            id: 'channel-1',
            isTextBased: () => true,
            send,
        };
        const guild = {
            id: 'guild-1',
            name: 'Guild One',
            channels: {
                cache: new Map<string, unknown>([['channel-1', channel]]),
                fetch: vi.fn(),
            },
            members: {
                fetch: vi.fn(),
            },
        };
        const client = {
            guilds: {
                cache: new Map<string, unknown>([['guild-1', guild]]),
            },
        } as any;

        mockEventService.getEventsStartingBetween.mockResolvedValue([
            {
                id: 'event-2',
                guildId: 'guild-1',
                channelId: 'channel-1',
                title: 'No Mention Event',
                startTime: new Date(),
                mentionOnStart: false,
                mentionRoleIds: ['role-a'],
                attendeeRoleId: null,
                location: 'Voice Lobby',
            },
        ]);
        mockEventService.getRsvpsByEvent.mockResolvedValue([]);
        mockIsModuleEnabled.mockResolvedValue(true);

        await execute(client);

        const payload = send.mock.calls[0][0];
        expect(payload.content).toBeUndefined();
        expect(payload.allowedMentions).toBeUndefined();
        const embedJson = payload.embeds[0].toJSON();
        expect(embedJson.fields?.some((f: any) => f.name === 'Location' && f.value === 'Voice Lobby')).toBe(true);
        expect(embedJson.fields?.some((f: any) => f.name === 'Attendees (0)' && f.value === 'No confirmed attendees yet.')).toBe(true);
    });

    it('logs warning and skips when channel cannot be resolved', async () => {
        const { execute } = await import('../../jobs/event-start');

        const guild = {
            id: 'guild-1',
            channels: {
                cache: new Map<string, unknown>(),
                fetch: vi.fn().mockResolvedValue(null),
            },
            members: {
                fetch: vi.fn(),
            },
        };
        const client = {
            guilds: {
                cache: new Map<string, unknown>([['guild-1', guild]]),
            },
        } as any;

        mockEventService.getEventsStartingBetween.mockResolvedValue([
            {
                id: 'event-3',
                guildId: 'guild-1',
                channelId: 'missing-channel',
                title: 'Missing Channel',
                startTime: new Date(),
                mentionOnStart: false,
                mentionRoleIds: null,
                attendeeRoleId: null,
                location: null,
            },
        ]);
        mockIsModuleEnabled.mockResolvedValue(true);

        await execute(client);

        expect(mockLogger.warn).toHaveBeenCalledWith('Channel missing-channel not found for starting event event-3');
    });
});
