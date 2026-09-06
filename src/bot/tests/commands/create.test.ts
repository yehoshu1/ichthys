import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEventService = {
    createEvent: vi.fn(),
    setEventMessageId: vi.fn(),
    createRepeatingEvents: vi.fn(),
};

const mockIsSupportedPostChannel = vi.fn();
const mockGetEventPollSettingsForGuild = vi.fn();
const mockGetCommandPolicyContext = vi.fn();
const mockParseNaturalLanguageDate = vi.fn();
const mockFormatDiscordTimestamp = vi.fn();
const mockCreateEventMessage = vi.fn();
const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
};

vi.mock('../../services/event-service', () => ({
    eventService: mockEventService,
}));

vi.mock('../../services/event-poll-settings-service', () => ({
    isSupportedPostChannel: mockIsSupportedPostChannel,
    getEventPollSettingsForGuild: mockGetEventPollSettingsForGuild,
}));

vi.mock('../../services/command-policy-service', () => ({
    getCommandPolicyContext: mockGetCommandPolicyContext,
}));

vi.mock('../../services/event-discord-service', () => ({
    eventDiscordService: {
        createEventMessage: mockCreateEventMessage,
    },
}));

vi.mock('../../utils/date-parser', () => ({
    parseNaturalLanguageDate: mockParseNaturalLanguageDate,
    formatDiscordTimestamp: mockFormatDiscordTimestamp,
}));

vi.mock('../../utils/logger', () => ({
    default: mockLogger,
}));

function createCreateInteraction(overrides?: {
    channelSendReject?: boolean;
    optionStrings?: Record<string, string | null>;
    optionIntegers?: Record<string, number | null>;
    optionBooleans?: Record<string, boolean | null>;
    optionRoles?: Record<string, { id: string } | null>;
    optionChannels?: Record<string, { id: string } | null>;
}) {
    const optionStrings = {
        title: 'Event Title',
        datetime: 'tomorrow 6pm',
        description: null,
        duration: null,
        location: null,
        image: null,
        repeat: null,
        repeat_until: null,
        ...overrides?.optionStrings,
    } as Record<string, string | null>;
    const optionIntegers = {
        max_attendees: null,
        ...overrides?.optionIntegers,
    } as Record<string, number | null>;
    const optionBooleans = {
        enable_waitlist: null,
        mirror_to_discord: null,
        ...overrides?.optionBooleans,
    } as Record<string, boolean | null>;
    const optionRoles = {
        mention_on_create: null,
        mention_on_start: null,
        required_role: null,
        blocked_role: null,
        attendee_role: null,
        ...overrides?.optionRoles,
    } as Record<string, { id: string } | null>;
    const optionChannels = {
        location_voice_channel: null,
        ...overrides?.optionChannels,
    } as Record<string, { id: string } | null>;

    const send = overrides?.channelSendReject
        ? vi.fn().mockRejectedValue(new Error('send failed'))
        : vi.fn().mockResolvedValue({ id: 'message-1' });
    const channel = { id: 'channel-1', send };

    const interaction: any = {
        deferred: false,
        replied: false,
        guild: { id: 'guild-1', name: 'Guild One' },
        channel,
        user: { id: 'user-1', tag: 'User#0001' },
        options: {
            getString: (name: string) => optionStrings[name] ?? null,
            getInteger: (name: string) => optionIntegers[name] ?? null,
            getBoolean: (name: string) => optionBooleans[name] ?? null,
            getRole: (name: string) => optionRoles[name] ?? null,
            getChannel: (name: string) => optionChannels[name] ?? null,
        },
        deferReply: vi.fn().mockImplementation(async () => {
            interaction.deferred = true;
        }),
        editReply: vi.fn().mockResolvedValue(undefined),
        reply: vi.fn().mockImplementation(async () => {
            interaction.replied = true;
        }),
        followUp: vi.fn().mockResolvedValue(undefined),
    };

    return { interaction, channelSend: send };
}

function createCreatedEvent(overrides?: Partial<Record<string, unknown>>) {
    return {
        id: 'event-1',
        guildId: 'guild-1',
        title: 'Event Title',
        description: null,
        startTime: new Date('2026-03-12T18:00:00.000Z'),
        endTime: null,
        location: null,
        locationChannelId: null,
        imageUrl: null,
        maxAttendees: null,
        enableWaitlist: false,
        requiredRoleIds: null,
        attendeeRoleId: null,
        repeatFrequency: 'NONE',
        mirrorToDiscord: false,
        discordScheduledEventId: null,
        createdAt: new Date('2026-03-11T12:00:00.000Z'),
        ...overrides,
    };
}

describe('/create command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsSupportedPostChannel.mockReturnValue(true);
        mockGetCommandPolicyContext.mockReturnValue(null);
        mockGetEventPollSettingsForGuild.mockResolvedValue(null);
        mockFormatDiscordTimestamp.mockImplementation((date: Date, style: string) =>
            `<t:${Math.floor(new Date(date).getTime() / 1000)}:${style}>`
        );
    });

    it('rejects unsupported target channels', async () => {
        const { execute } = await import('../../commands/create');
        const { interaction } = createCreateInteraction();
        mockIsSupportedPostChannel.mockReturnValue(false);

        await execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith({ content: 'Please specify a valid text channel.' });
        expect(mockEventService.createEvent).not.toHaveBeenCalled();
    });

    it('rejects invalid or past datetime values', async () => {
        const { execute } = await import('../../commands/create');
        const { interaction } = createCreateInteraction();

        mockParseNaturalLanguageDate.mockReturnValue(new Date(Date.now() - 60_000));

        await execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith({
            content: 'Invalid date/time. Please use a future date/time (e.g., "tomorrow 6pm", "in 3 hours").',
        });
        expect(mockEventService.createEvent).not.toHaveBeenCalled();
    });

    it('creates event, posts embed message, and stores message id', async () => {
        const { execute } = await import('../../commands/create');
        const { interaction } = createCreateInteraction({
            optionRoles: {
                mention_on_create: { id: 'role-1' },
                mention_on_start: null,
                required_role: null,
                blocked_role: null,
                attendee_role: null,
            },
        });
        const startTime = new Date(Date.now() + 60 * 60_000);
        mockParseNaturalLanguageDate.mockImplementation((input: string) => (
            input === 'tomorrow 6pm' ? startTime : null
        ));
        mockEventService.createEvent.mockResolvedValue(createCreatedEvent({ startTime }));
        mockCreateEventMessage.mockImplementation(async (event: any) => {
            await mockEventService.setEventMessageId(event.id, 'message-1');
            return { id: 'message-1' };
        });

        await execute(interaction);

        expect(mockEventService.createEvent).toHaveBeenCalledTimes(1);
        expect(mockCreateEventMessage).toHaveBeenCalledTimes(1);
        expect(mockEventService.setEventMessageId).toHaveBeenCalledWith('event-1', 'message-1');
        expect(interaction.editReply).toHaveBeenCalledWith({ content: '✅ Event created successfully! ' });
    });

    it('returns success with warning when event is saved but channel post fails', async () => {
        const { execute } = await import('../../commands/create');
        const { interaction } = createCreateInteraction();
        const startTime = new Date(Date.now() + 2 * 60 * 60_000);

        mockParseNaturalLanguageDate.mockImplementation((input: string) => (
            input === 'tomorrow 6pm' ? startTime : null
        ));
        mockEventService.createEvent.mockResolvedValue(createCreatedEvent({ startTime }));
        mockCreateEventMessage.mockRejectedValue(new Error('send failed'));

        await execute(interaction);

        expect(mockEventService.createEvent).toHaveBeenCalledTimes(1);
        expect(mockEventService.setEventMessageId).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith({
            content: '✅ Event created successfully!  ⚠️ Event was saved, but I could not post its embed in the target channel.',
        });
    });

    it('creates repeating events when repeat options are provided', async () => {
        const { execute } = await import('../../commands/create');
        const repeatUntil = new Date(Date.now() + 10 * 24 * 60 * 60_000);
        const startTime = new Date(Date.now() + 24 * 60 * 60_000);
        const { interaction } = createCreateInteraction({
            optionStrings: {
                title: 'Event Title',
                datetime: 'tomorrow 6pm',
                description: null,
                duration: null,
                location: null,
                image: null,
                repeat: 'WEEKLY',
                repeat_until: 'in 10 days',
            },
        });

        mockParseNaturalLanguageDate.mockImplementation((input: string) => {
            if (input === 'tomorrow 6pm') return startTime;
            if (input === 'in 10 days') return repeatUntil;
            return null;
        });
        mockEventService.createEvent.mockResolvedValue(createCreatedEvent({
            startTime,
            repeatFrequency: 'WEEKLY',
            repeatUntil,
        }));
        mockCreateEventMessage.mockResolvedValue({ id: 'message-1' });
        mockEventService.createRepeatingEvents.mockResolvedValue([
            { id: 'event-2' },
            { id: 'event-3' },
        ]);

        await execute(interaction);

        expect(mockEventService.createRepeatingEvents).toHaveBeenCalledTimes(1);
        expect(interaction.editReply).toHaveBeenCalledWith({
            content: '✅ Event created successfully! + 2 repeating instances ',
        });
    });
});
