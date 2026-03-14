import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEventService = {
    getEventById: vi.fn(),
    upsertReminder: vi.fn(),
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

vi.mock('../../utils/date-parser', () => ({
    formatDiscordTimestamp: mockFormatDiscordTimestamp,
}));

vi.mock('../../utils/logger', () => ({
    default: mockLogger,
}));

function createRemindInteraction(input: { eventId: string; when: string; guildId?: string }) {
    const guildId = input.guildId ?? 'guild-1';
    return {
        guild: { id: guildId },
        user: { id: 'user-1' },
        options: {
            getString: (name: string) => {
                if (name === 'event_id') return input.eventId;
                if (name === 'when') return input.when;
                return null;
            },
        },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
    } as any;
}

describe('/remind command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFormatDiscordTimestamp.mockImplementation((date: Date, style: string) =>
            `<t:${Math.floor(new Date(date).getTime() / 1000)}:${style}>`
        );
    });

    it('returns not found when event does not exist', async () => {
        const { execute } = await import('../../commands/remind');
        const interaction = createRemindInteraction({ eventId: 'missing-event', when: '10 minutes before' });

        mockEventService.getEventById.mockResolvedValue(undefined);

        await execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            'Event not found. Use `/list type:events` to see available events.'
        );
    });

    it('blocks reminders for events in another guild', async () => {
        const { execute } = await import('../../commands/remind');
        const interaction = createRemindInteraction({ eventId: 'event-1', when: '10 minutes before', guildId: 'guild-a' });

        mockEventService.getEventById.mockResolvedValue({
            id: 'event-1',
            guildId: 'guild-b',
            title: 'Other Guild Event',
            startTime: new Date(Date.now() + 60 * 60_000),
        });

        await execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith('This event is not in this server.');
    });

    it('validates unparseable reminder input', async () => {
        const { execute } = await import('../../commands/remind');
        const interaction = createRemindInteraction({ eventId: 'event-1', when: 'sometime maybe' });

        mockEventService.getEventById.mockResolvedValue({
            id: 'event-1',
            guildId: 'guild-1',
            title: 'Bible Study',
            startTime: new Date(Date.now() + 60 * 60_000),
        });

        await execute(interaction);

        const message = interaction.editReply.mock.calls[0][0] as string;
        expect(message).toContain('Invalid reminder time.');
    });

    it('blocks reminders when requested reminder time is already in the past', async () => {
        const { execute } = await import('../../commands/remind');
        const interaction = createRemindInteraction({ eventId: 'event-1', when: '2 hours before' });

        mockEventService.getEventById.mockResolvedValue({
            id: 'event-1',
            guildId: 'guild-1',
            title: 'Soon Event',
            startTime: new Date(Date.now() + 30 * 60_000),
        });

        await execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith('That reminder time has already passed. The event is too soon.');
    });

    it('returns unchanged message when same reminder already exists', async () => {
        const { execute } = await import('../../commands/remind');
        const interaction = createRemindInteraction({ eventId: 'event-1', when: '10 minutes before' });

        mockEventService.getEventById.mockResolvedValue({
            id: 'event-1',
            guildId: 'guild-1',
            title: 'Prayer Circle',
            startTime: new Date(Date.now() + 120 * 60_000),
        });
        mockEventService.upsertReminder.mockResolvedValue({ status: 'unchanged' });

        await execute(interaction);

        expect(mockEventService.upsertReminder).toHaveBeenCalledWith('event-1', 'user-1', 10);
        expect(interaction.editReply).toHaveBeenCalledWith('You already have a reminder set for that time.');
    });

    it('sets reminder and responds with confirmation embed', async () => {
        const { execute } = await import('../../commands/remind');
        const interaction = createRemindInteraction({ eventId: 'event-1', when: '1 hour before' });

        const startTime = new Date(Date.now() + 180 * 60_000);
        mockEventService.getEventById.mockResolvedValue({
            id: 'event-1',
            guildId: 'guild-1',
            title: 'Youth Service',
            startTime,
        });
        mockEventService.upsertReminder.mockResolvedValue({ status: 'created' });

        await execute(interaction);

        expect(mockEventService.upsertReminder).toHaveBeenCalledWith('event-1', 'user-1', 60);
        const payload = interaction.editReply.mock.calls[0][0];
        expect(payload.embeds).toHaveLength(1);
        const embedJson = payload.embeds[0].toJSON();
        expect(embedJson.title).toBe('⏰ Reminder Set');
        expect(embedJson.fields?.some((f: any) => f.name === 'Event' && f.value === 'Youth Service')).toBe(true);
    });
});
