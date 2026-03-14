import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEventService = {
    getEventsByGuild: vi.fn(),
    getRsvpCounts: vi.fn(),
};

const mockPollService = {
    getPollsByGuild: vi.fn(),
    getResults: vi.fn(),
};

const mockFormatDiscordTimestamp = vi.fn();
const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
};

vi.mock('../../services/event-service', () => ({
    eventService: mockEventService,
}));

vi.mock('../../services/poll-service', () => ({
    pollService: mockPollService,
}));

vi.mock('../../utils/date-parser', () => ({
    formatDiscordTimestamp: mockFormatDiscordTimestamp,
}));

vi.mock('../../utils/logger', () => ({
    default: mockLogger,
}));

function createListInteraction(input: {
    type: 'events' | 'polls';
    channelId?: string | null;
    limit?: number | null;
}) {
    const channel = input.channelId ? { id: input.channelId } : null;
    const limit = input.limit ?? null;

    return {
        guild: { id: 'guild-1' },
        options: {
            getString: (name: string) => (name === 'type' ? input.type : null),
            getChannel: (name: string) => (name === 'channel' ? channel : null),
            getInteger: (name: string) => (name === 'limit' ? limit : null),
        },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
    } as any;
}

describe('/list command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFormatDiscordTimestamp.mockImplementation((date: Date, style: string) =>
            `<t:${Math.floor(new Date(date).getTime() / 1000)}:${style}>`
        );
    });

    it('returns empty response message when no upcoming events exist', async () => {
        const { execute } = await import('../../commands/list');
        const interaction = createListInteraction({ type: 'events' });

        mockEventService.getEventsByGuild.mockResolvedValue([]);

        await execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
        expect(interaction.editReply).toHaveBeenCalledWith('No upcoming events found.');
    });

    it('renders events embed with ID only inside field name', async () => {
        const { execute } = await import('../../commands/list');
        const interaction = createListInteraction({ type: 'events', limit: 1 });

        mockEventService.getEventsByGuild.mockResolvedValue([
            {
                id: 'event-123',
                title: 'Prayer Night',
                channelId: 'text-1',
                startTime: new Date('2026-03-11T17:00:00.000Z'),
                location: null,
                locationChannelId: null,
                maxAttendees: null,
            },
        ]);
        mockEventService.getRsvpCounts.mockResolvedValue({
            yes: 2,
            maybe: 1,
            no: 0,
            waitlist: 0,
        });

        await execute(interaction);

        const replyPayload = interaction.editReply.mock.calls[0][0];
        expect(replyPayload.content).toBeUndefined();
        expect(replyPayload.embeds).toHaveLength(1);

        const embedJson = replyPayload.embeds[0].toJSON();
        expect(embedJson.fields?.[0]?.name).toContain('ID: event-123');
        expect(embedJson.fields?.[0]?.value).not.toContain('ID:');
    });

    it('respects channel filtering for events', async () => {
        const { execute } = await import('../../commands/list');
        const interaction = createListInteraction({ type: 'events', channelId: 'channel-b' });

        mockEventService.getEventsByGuild.mockResolvedValue([
            {
                id: 'event-1',
                title: 'Event A',
                channelId: 'channel-a',
                startTime: new Date(),
                location: null,
                locationChannelId: null,
                maxAttendees: null,
            },
        ]);

        await execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith('No upcoming events found in the specified channel.');
    });

    it('renders polls embed with ID only inside field name', async () => {
        const { execute } = await import('../../commands/list');
        const interaction = createListInteraction({ type: 'polls', limit: 1 });

        mockPollService.getPollsByGuild.mockResolvedValue([
            {
                id: 'poll-123',
                question: 'Best day?',
                channelId: 'text-2',
                endTime: new Date('2026-03-11T20:00:00.000Z'),
                type: 'STANDARD',
            },
        ]);
        mockPollService.getResults.mockResolvedValue({ totalVotes: 8 });

        await execute(interaction);

        const replyPayload = interaction.editReply.mock.calls[0][0];
        expect(replyPayload.content).toBeUndefined();
        expect(replyPayload.embeds).toHaveLength(1);

        const embedJson = replyPayload.embeds[0].toJSON();
        expect(embedJson.fields?.[0]?.name).toContain('ID: poll-123');
        expect(embedJson.fields?.[0]?.value).not.toContain('ID:');
    });
});
