import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    dbMock,
    dbSelectWhereMock,
    dbInsertValuesMock,
    dbInsertReturningMock,
    dbUpdateSetMock,
    dbUpdateWhereMock,
    dbUpdateReturningMock,
    txMock,
    mockWebhookTrigger,
} = vi.hoisted(() => {
    const dbInsertReturningMock = vi.fn();
    const dbInsertValuesMock = vi.fn().mockReturnValue({ returning: dbInsertReturningMock });

    const dbUpdateReturningMock = vi.fn();
    const dbUpdateWhereMock = vi.fn().mockReturnValue({ returning: dbUpdateReturningMock });
    const dbUpdateSetMock = vi.fn().mockReturnValue({ where: dbUpdateWhereMock });

    const dbSelectWhereMock = vi.fn();
    const dbSelectFromMock = vi.fn().mockReturnValue({ where: dbSelectWhereMock });

    const txDeleteWhereMock = vi.fn().mockResolvedValue({ rowCount: 1 });
    const txMock = {
        update: vi.fn(),
        insert: vi.fn(),
        delete: vi.fn().mockReturnValue({ where: txDeleteWhereMock }),
        select: vi.fn(),
        _txDeleteWhereMock: txDeleteWhereMock,
    };

    const dbTransactionMock = vi.fn().mockImplementation(async (cb: (tx: typeof txMock) => any) => cb(txMock));

    const dbMock = {
        select: vi.fn().mockReturnValue({ from: dbSelectFromMock }),
        update: vi.fn().mockReturnValue({ set: dbUpdateSetMock }),
        insert: vi.fn().mockReturnValue({ values: dbInsertValuesMock }),
        delete: vi.fn(),
        transaction: dbTransactionMock,
    };

    const mockWebhookTrigger = vi.fn().mockResolvedValue(undefined);

    return {
        dbMock, dbSelectWhereMock,
        dbInsertValuesMock, dbInsertReturningMock,
        dbUpdateSetMock, dbUpdateWhereMock, dbUpdateReturningMock,
        txMock, mockWebhookTrigger,
    };
});

vi.mock('@shared/database/client', () => ({ db: dbMock }));
vi.mock('@shared/database/schema', () => ({ poll: {}, pollOption: {}, pollVote: {} }));
// Correct path: src/shared/services/__tests__/ → ../../../ → src/ → bot/services/webhook-service
vi.mock('../../../bot/services/webhook-service', () => ({
    webhookService: { triggerEvent: mockWebhookTrigger },
}));

const fetchMock = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('fetch', fetchMock);

import { pollService } from '../poll-domain-service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePollRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 'poll-1',
        guildId: 'guild-1',
        creatorId: 'user-1',
        channelId: 'channel-1',
        question: 'Favourite colour?',
        description: null,
        color: null,
        type: 'STANDARD',
        allowMultipleVotes: false,
        maxVotesPerUser: null,
        allowCustomOptions: false,
        allowedRoleIds: null,
        mentionRoleIds: null,
        mentionOnCreate: false,
        endTime: null,
        closed: false,
        closedAt: null,
        messageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

function makeCreatePollData(overrides: Record<string, unknown> = {}) {
    return {
        guildId: 'guild-1',
        creatorId: 'user-1',
        channelId: 'channel-1',
        question: 'Favourite colour?',
        type: 'STANDARD' as const,
        options: [{ text: 'Red' }, { text: 'Blue' }],
        ...overrides,
    };
}

function restoreChains() {
    // select: .select().from().where() → Promise (default for most queries)
    const dbSelectFromMock = vi.fn().mockReturnValue({ where: dbSelectWhereMock });
    dbMock.select.mockReturnValue({ from: dbSelectFromMock });

    // insert chain
    dbInsertValuesMock.mockReturnValue({ returning: dbInsertReturningMock });
    dbMock.insert.mockReturnValue({ values: dbInsertValuesMock });

    // update chain
    dbUpdateWhereMock.mockReturnValue({ returning: dbUpdateReturningMock });
    dbUpdateSetMock.mockReturnValue({ where: dbUpdateWhereMock });
    dbMock.update.mockReturnValue({ set: dbUpdateSetMock });

    // transaction: restored because vi.resetAllMocks() wipes the implementation
    dbMock.transaction.mockImplementation(async (cb: (tx: typeof txMock) => any) => cb(txMock));

    // transaction inner tx mocks
    const txDeleteWhereMock = vi.fn().mockResolvedValue({ rowCount: 1 });
    txMock.delete.mockReturnValue({ where: txDeleteWhereMock });

    mockWebhookTrigger.mockResolvedValue(undefined);
    fetchMock.mockResolvedValue({ ok: true });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('pollService.createPoll', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        restoreChains();
    });

    it('inserts the poll and returns it', async () => {
        const created = makePollRow();
        dbInsertReturningMock.mockResolvedValueOnce([created]);

        const result = await pollService.createPoll(makeCreatePollData());
        expect(result).toEqual(created);
        expect(dbMock.insert).toHaveBeenCalled();
    });

    it('inserts one row per option after inserting the poll', async () => {
        dbInsertReturningMock.mockResolvedValueOnce([makePollRow()]);

        await pollService.createPoll(makeCreatePollData({ options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }] }));

        // 1 insert for poll + 3 for options = 4
        expect(dbMock.insert).toHaveBeenCalledTimes(4);
    });

    it('fires a webhook after creation', async () => {
        dbInsertReturningMock.mockResolvedValueOnce([makePollRow()]);

        await pollService.createPoll(makeCreatePollData());

        expect(mockWebhookTrigger).toHaveBeenCalledWith('guild-1', 'poll.created', expect.objectContaining({
            pollId: 'poll-1',
            question: 'Favourite colour?',
        }));
    });

    it('sets correct defaults (allowMultipleVotes=false, closed=false)', async () => {
        dbInsertReturningMock.mockResolvedValueOnce([makePollRow()]);

        await pollService.createPoll(makeCreatePollData());

        const inserted = dbInsertValuesMock.mock.calls[0][0];
        expect(inserted.allowMultipleVotes).toBe(false);
        expect(inserted.closed).toBe(false);
    });
});

describe('pollService.getPollById', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        restoreChains();
    });

    it('returns the poll when found', async () => {
        dbSelectWhereMock.mockResolvedValueOnce([makePollRow()]);
        const result = await pollService.getPollById('poll-1');
        expect(result?.id).toBe('poll-1');
    });

    it('returns undefined when not found', async () => {
        dbSelectWhereMock.mockResolvedValueOnce([]);
        const result = await pollService.getPollById('missing');
        expect(result).toBeUndefined();
    });
});

describe('pollService.closePoll', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        restoreChains();
    });

    it('returns undefined when poll does not exist', async () => {
        dbSelectWhereMock.mockResolvedValueOnce([]);
        expect(await pollService.closePoll('missing')).toBeUndefined();
    });

    it('marks the poll as closed and fires a webhook', async () => {
        const closed = makePollRow({ closed: true, closedAt: new Date() });

        dbSelectWhereMock
            .mockResolvedValueOnce([makePollRow()])       // getPollById
            .mockResolvedValueOnce([{ count: 42 }]);      // vote count

        dbUpdateReturningMock.mockResolvedValueOnce([closed]);

        const result = await pollService.closePoll('poll-1');
        expect(result?.closed).toBe(true);
        expect(mockWebhookTrigger).toHaveBeenCalledWith('guild-1', 'poll.closed', expect.objectContaining({
            pollId: 'poll-1',
        }));
    });
});

describe('pollService.deletePollWithRelations', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        restoreChains();
    });

    it('deletes votes, options, and poll inside a transaction and returns true', async () => {
        const txDeleteWhereMock = vi.fn().mockResolvedValue({ rowCount: 1 });
        txMock.delete.mockReturnValue({ where: txDeleteWhereMock });

        const result = await pollService.deletePollWithRelations('poll-1');
        expect(dbMock.transaction).toHaveBeenCalled();
        expect(txMock.delete).toHaveBeenCalledTimes(3);
        expect(result).toBe(true);
    });

    it('returns false when the poll row was not deleted (rowCount=0)', async () => {
        const txDeleteWhereMock = vi.fn().mockResolvedValue({ rowCount: 0 });
        txMock.delete.mockReturnValue({ where: txDeleteWhereMock });

        expect(await pollService.deletePollWithRelations('poll-1')).toBe(false);
    });
});

describe('pollService.deletePollWithArtifacts', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        restoreChains();
    });

    it('returns false when poll does not exist', async () => {
        dbSelectWhereMock.mockResolvedValueOnce([]);
        expect(await pollService.deletePollWithArtifacts('missing')).toBe(false);
    });

    it('deletes Discord message when messageId is set', async () => {
        process.env.DISCORD_TOKEN = 'test-token';
        dbSelectWhereMock.mockResolvedValueOnce([makePollRow({ messageId: 'msg-abc' })]);

        await pollService.deletePollWithArtifacts('poll-1');
        delete process.env.DISCORD_TOKEN;

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('messages/msg-abc'),
            expect.objectContaining({ method: 'DELETE' })
        );
    });

    it('does not call Discord REST when messageId is null', async () => {
        dbSelectWhereMock.mockResolvedValueOnce([makePollRow({ messageId: null })]);
        await pollService.deletePollWithArtifacts('poll-1');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('pollService.addPollOption', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        restoreChains();
    });

    it('appends an option with the correct order index', async () => {
        // addPollOption uses .where().orderBy() — wire where() to return {orderBy}
        const orderByMock = vi.fn().mockResolvedValueOnce([
            { id: 'opt-1', order: 0 },
            { id: 'opt-2', order: 1 },
        ]);
        dbSelectWhereMock.mockReturnValueOnce({ orderBy: orderByMock });

        const newOption = { id: 'opt-3', pollId: 'poll-1', order: 2, text: 'Green', emoji: null };
        dbInsertReturningMock.mockResolvedValueOnce([newOption]);

        const result = await pollService.addPollOption('poll-1', 'Green');

        expect(result).toEqual(newOption);
        const insertedData = dbInsertValuesMock.mock.calls[0][0];
        expect(insertedData.order).toBe(2);
        expect(insertedData.text).toBe('Green');
    });

    it('inserts with order 0 when there are no existing options', async () => {
        const orderByMock = vi.fn().mockResolvedValueOnce([]);
        dbSelectWhereMock.mockReturnValueOnce({ orderBy: orderByMock });

        const newOption = { id: 'opt-1', pollId: 'poll-1', order: 0, text: 'Only Option' };
        dbInsertReturningMock.mockResolvedValueOnce([newOption]);

        await pollService.addPollOption('poll-1', 'Only Option');

        const insertedData = dbInsertValuesMock.mock.calls[0][0];
        expect(insertedData.order).toBe(0);
    });
});

describe('pollService.setPollMessageId', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        restoreChains();
        // setPollMessageId: .update().set().where() resolves directly (no .returning())
        dbUpdateWhereMock.mockResolvedValue({});
    });

    it('calls update with the provided messageId', async () => {
        await pollService.setPollMessageId('poll-1', 'msg-xyz');
        expect(dbMock.update).toHaveBeenCalled();
        const setArgs = dbUpdateSetMock.mock.calls[0][0];
        expect(setArgs.messageId).toBe('msg-xyz');
    });
});
