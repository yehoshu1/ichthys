import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEventService = {
    getEventById: vi.fn(),
    deleteEvent: vi.fn(),
};

const mockPollService = {
    getPollById: vi.fn(),
    deletePollWithArtifacts: vi.fn(),
};

const mockCanManage = vi.fn();
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

vi.mock('../../services/resource-authorization-service', () => ({
    canMemberManageCreatorOwnedResource: mockCanManage,
}));

vi.mock('../../utils/logger', () => ({
    default: mockLogger,
}));

function createDeleteInteraction(input: {
    type: 'event' | 'poll';
    id: string;
    reason?: string | null;
    guildId?: string;
}) {
    const guildId = input.guildId ?? 'guild-1';
    const member = { id: 'member-1', permissions: { has: () => false } };

    return {
        guild: {
            id: guildId,
            members: {
                fetch: vi.fn().mockResolvedValue(member),
            },
        },
        guildId,
        member: null,
        user: { id: 'user-1', tag: 'User#0001' },
        options: {
            getString: (name: string) => {
                if (name === 'type') return input.type;
                if (name === 'id') return input.id;
                if (name === 'reason') return input.reason ?? null;
                return null;
            },
        },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
    } as any;
}

describe('/delete command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns not found when event is missing', async () => {
        const { execute } = await import('../../commands/delete');
        const interaction = createDeleteInteraction({ type: 'event', id: 'missing-event' });

        mockEventService.getEventById.mockResolvedValue(undefined);

        await execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            'Event not found. Use `/list type:events` to see available events.'
        );
    });

    it('denies event deletion without authorization', async () => {
        const { execute } = await import('../../commands/delete');
        const interaction = createDeleteInteraction({ type: 'event', id: 'event-1' });

        mockEventService.getEventById.mockResolvedValue({
            id: 'event-1',
            guildId: 'guild-1',
            title: 'Sunday Service',
            creatorId: 'creator-1',
        });
        mockCanManage.mockReturnValue(false);

        await execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            'You can only delete events you created or if you have Manage Events permission.'
        );
        expect(mockEventService.deleteEvent).not.toHaveBeenCalled();
    });

    it('deletes event when authorized and includes reason in response', async () => {
        const { execute } = await import('../../commands/delete');
        const interaction = createDeleteInteraction({
            type: 'event',
            id: 'event-2',
            reason: 'Rescheduled',
        });

        mockEventService.getEventById.mockResolvedValue({
            id: 'event-2',
            guildId: 'guild-1',
            title: 'Prayer Meeting',
            creatorId: 'creator-1',
        });
        mockCanManage.mockReturnValue(true);
        mockEventService.deleteEvent.mockResolvedValue(true);

        await execute(interaction);

        expect(mockEventService.deleteEvent).toHaveBeenCalledWith('event-2');
        expect(interaction.editReply).toHaveBeenCalledWith(
            '✅ Event "Prayer Meeting" has been deleted.\nReason: Rescheduled'
        );
    });

    it('deletes poll when authorized', async () => {
        const { execute } = await import('../../commands/delete');
        const interaction = createDeleteInteraction({ type: 'poll', id: 'poll-1' });

        mockPollService.getPollById.mockResolvedValue({
            id: 'poll-1',
            guildId: 'guild-1',
            question: 'Where should we meet?',
            creatorId: 'creator-1',
        });
        mockCanManage.mockReturnValue(true);
        mockPollService.deletePollWithArtifacts.mockResolvedValue(true);

        await execute(interaction);

        expect(mockPollService.deletePollWithArtifacts).toHaveBeenCalledWith('poll-1');
        expect(interaction.editReply).toHaveBeenCalledWith('✅ Poll "Where should we meet?" has been deleted.');
    });
});
