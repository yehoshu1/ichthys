import { beforeEach, describe, expect, it, vi } from 'vitest';

// All mock variables must be declared via vi.hoisted() so they are initialized
// before vi.mock() factory functions (which are hoisted to the top of the file).
const {
    dbMock,
    dbSelectLimitMock,
    dbSelectWhereMock,
    dbUpdateSetMock,
    dbUpdateWhereMock,
    dbInsertValuesMock,
    dbFindFirstMock,
    mockClientMock,
    mockIsModuleEnabled,
    mockEmitNotification,
    mockUnban,
} = vi.hoisted(() => {
    const dbSelectLimitMock = vi.fn().mockResolvedValue([]);
    const dbSelectWhereMock = vi.fn().mockReturnValue({ limit: dbSelectLimitMock });
    const dbSelectFromMock = vi.fn().mockReturnValue({ where: dbSelectWhereMock });

    const dbUpdateWhereMock = vi.fn().mockResolvedValue({});
    const dbUpdateSetMock = vi.fn().mockReturnValue({ where: dbUpdateWhereMock });

    const dbInsertValuesMock = vi.fn().mockResolvedValue({});
    const dbFindFirstMock = vi.fn().mockResolvedValue(null);

    const dbMock = {
        select: vi.fn().mockReturnValue({ from: dbSelectFromMock }),
        update: vi.fn().mockReturnValue({ set: dbUpdateSetMock }),
        insert: vi.fn().mockReturnValue({ values: dbInsertValuesMock }),
        query: { moderationSettings: { findFirst: dbFindFirstMock } },
    };

    const mockUnban = vi.fn().mockResolvedValue(undefined);
    const mockClientMock = { guilds: { fetch: vi.fn() } };
    const mockIsModuleEnabled = vi.fn().mockResolvedValue(true);
    const mockEmitNotification = vi.fn().mockResolvedValue(undefined);

    return {
        dbMock,
        dbSelectLimitMock,
        dbSelectWhereMock,
        dbUpdateSetMock,
        dbUpdateWhereMock,
        dbInsertValuesMock,
        dbFindFirstMock,
        mockClientMock,
        mockIsModuleEnabled,
        mockEmitNotification,
        mockUnban,
    };
});

// Paths are resolved relative to this test file (src/bot/tests/jobs/).
// Source file is at src/bot/jobs/, so e.g. '../../client' → src/bot/client.
vi.mock('@shared/database/client', () => ({ db: dbMock }));
vi.mock('@shared/database/schema', () => ({
    moderationCase: {},
    moderationSettings: {},
    actionLog: {},
}));
vi.mock('../../client', () => ({ default: mockClientMock }));
vi.mock('@shared/modules/state', () => ({ isModuleEnabled: mockIsModuleEnabled }));
vi.mock('../../services/notificationEmitter', () => ({
    emitGuildNotificationSafe: mockEmitNotification,
}));
vi.mock('../../utils/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { processModerationExpirationsOnce } from '../../jobs/processModerationExpirations';

// ── Helper ───────────────────────────────────────────────────────────────────

function makeModerationCase(overrides: Record<string, unknown> = {}) {
    return {
        id: 'case-1',
        guildId: 'guild-1',
        userId: 'user-1',
        caseNumber: 1,
        action: 'MUTE',
        active: true,
        reason: 'Test reason',
        expiresAt: new Date(Date.now() - 1000),
        ...overrides,
    };
}

function makeGuild({
    memberVoiceServerMute = false,
    memberHasMuteRole = false,
    muteRoleId = 'mute-role',
    communicationDisabledUntilTimestamp = null as number | null,
} = {}) {
    const setMute = vi.fn().mockResolvedValue(undefined);
    const memberTimeout = vi.fn().mockResolvedValue(undefined);
    const memberRolesRemove = vi.fn().mockResolvedValue(undefined);

    const member = {
        voice: { serverMute: memberVoiceServerMute, setMute },
        communicationDisabledUntilTimestamp,
        roles: {
            cache: { has: (id: string) => memberHasMuteRole && id === muteRoleId },
            remove: memberRolesRemove,
        },
        timeout: memberTimeout,
    };

    const guild = {
        id: 'guild-1',
        members: {
            fetch: vi.fn().mockResolvedValue(member),
            unban: mockUnban,
        },
    };

    return { guild, member, setMute, memberTimeout, memberRolesRemove };
}

function restoreChains() {
    const dbSelectLimitMockLocal = dbSelectLimitMock;
    const dbSelectWhereMockLocal = dbSelectWhereMock;
    dbMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({ where: dbSelectWhereMockLocal.mockReturnValue({ limit: dbSelectLimitMockLocal }) }),
    });
    dbMock.update.mockReturnValue({ set: dbUpdateSetMock });
    dbUpdateSetMock.mockReturnValue({ where: dbUpdateWhereMock });
    dbUpdateWhereMock.mockResolvedValue({});
    dbMock.insert.mockReturnValue({ values: dbInsertValuesMock });
    dbInsertValuesMock.mockResolvedValue({});
    mockUnban.mockResolvedValue(undefined);
    mockEmitNotification.mockResolvedValue(undefined);
    mockIsModuleEnabled.mockResolvedValue(true);
    dbSelectLimitMock.mockResolvedValue([]);
    dbFindFirstMock.mockResolvedValue(null);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('processModerationExpirationsOnce', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        restoreChains();
    });

    it('does nothing when there are no expired cases', async () => {
        dbSelectLimitMock.mockResolvedValueOnce([]);
        await processModerationExpirationsOnce();
        expect(mockClientMock.guilds.fetch).not.toHaveBeenCalled();
    });

    it('skips processing when the moderation module is disabled for a guild', async () => {
        dbSelectLimitMock.mockResolvedValueOnce([makeModerationCase()]);
        mockIsModuleEnabled.mockResolvedValueOnce(false);

        await processModerationExpirationsOnce();

        expect(mockClientMock.guilds.fetch).not.toHaveBeenCalled();
    });

    it('caches the module-enabled check per guild (only one DB call for multiple cases)', async () => {
        dbSelectLimitMock.mockResolvedValueOnce([
            makeModerationCase({ id: 'case-1' }),
            makeModerationCase({ id: 'case-2' }),
        ]);
        mockIsModuleEnabled.mockResolvedValue(false);

        await processModerationExpirationsOnce();

        expect(mockIsModuleEnabled).toHaveBeenCalledTimes(1);
    });

    describe('MUTE expiration', () => {
        it('removes the mute role when the member has it', async () => {
            const { guild, memberRolesRemove } = makeGuild({ memberHasMuteRole: true });
            mockClientMock.guilds.fetch.mockResolvedValueOnce(guild);
            dbFindFirstMock.mockResolvedValueOnce({ muteRoleId: 'mute-role' });
            dbSelectLimitMock.mockResolvedValueOnce([makeModerationCase({ action: 'MUTE' })]);

            await processModerationExpirationsOnce();

            expect(memberRolesRemove).toHaveBeenCalledWith('mute-role', expect.any(String));
        });

        it('does not remove a role when the member does not have it', async () => {
            const { guild, memberRolesRemove } = makeGuild({ memberHasMuteRole: false });
            mockClientMock.guilds.fetch.mockResolvedValueOnce(guild);
            dbFindFirstMock.mockResolvedValueOnce({ muteRoleId: 'mute-role' });
            dbSelectLimitMock.mockResolvedValueOnce([makeModerationCase({ action: 'MUTE' })]);

            await processModerationExpirationsOnce();

            expect(memberRolesRemove).not.toHaveBeenCalled();
        });

        it('does not remove a role when muteRoleId is not configured', async () => {
            const { guild, memberRolesRemove } = makeGuild();
            mockClientMock.guilds.fetch.mockResolvedValueOnce(guild);
            dbFindFirstMock.mockResolvedValueOnce({ muteRoleId: null });
            dbSelectLimitMock.mockResolvedValueOnce([makeModerationCase({ action: 'MUTE' })]);

            await processModerationExpirationsOnce();

            expect(memberRolesRemove).not.toHaveBeenCalled();
        });

        it('unmutes voice when reason starts with "Voice mute:"', async () => {
            const { guild, setMute } = makeGuild({ memberVoiceServerMute: true });
            mockClientMock.guilds.fetch.mockResolvedValueOnce(guild);
            dbSelectLimitMock.mockResolvedValueOnce([
                makeModerationCase({ action: 'MUTE', reason: 'Voice mute: spamming voice' }),
            ]);

            await processModerationExpirationsOnce();

            expect(setMute).toHaveBeenCalledWith(false, expect.any(String));
        });

        it('skips voice unmute when member is not server-muted', async () => {
            const { guild, setMute } = makeGuild({ memberVoiceServerMute: false });
            mockClientMock.guilds.fetch.mockResolvedValueOnce(guild);
            dbSelectLimitMock.mockResolvedValueOnce([
                makeModerationCase({ action: 'MUTE', reason: 'Voice mute: test' }),
            ]);

            await processModerationExpirationsOnce();

            expect(setMute).not.toHaveBeenCalled();
        });
    });

    describe('TIMEOUT expiration', () => {
        it('removes the timeout when communicationDisabledUntilTimestamp is set', async () => {
            const { guild, memberTimeout } = makeGuild({ communicationDisabledUntilTimestamp: Date.now() + 10000 });
            mockClientMock.guilds.fetch.mockResolvedValueOnce(guild);
            dbSelectLimitMock.mockResolvedValueOnce([makeModerationCase({ action: 'TIMEOUT' })]);

            await processModerationExpirationsOnce();

            expect(memberTimeout).toHaveBeenCalledWith(null, expect.any(String));
        });

        it('skips when member has no active timeout', async () => {
            const { guild, memberTimeout } = makeGuild({ communicationDisabledUntilTimestamp: null });
            mockClientMock.guilds.fetch.mockResolvedValueOnce(guild);
            dbSelectLimitMock.mockResolvedValueOnce([makeModerationCase({ action: 'TIMEOUT' })]);

            await processModerationExpirationsOnce();

            expect(memberTimeout).not.toHaveBeenCalled();
        });
    });

    describe('BAN expiration', () => {
        it('unbans the user', async () => {
            const { guild } = makeGuild();
            mockClientMock.guilds.fetch.mockResolvedValueOnce(guild);
            dbSelectLimitMock.mockResolvedValueOnce([makeModerationCase({ action: 'BAN' })]);

            await processModerationExpirationsOnce();

            expect(mockUnban).toHaveBeenCalledWith('user-1', expect.any(String));
        });
    });

    describe('post-processing side-effects', () => {
        it('marks the case as inactive after successful expiration', async () => {
            const { guild } = makeGuild({ memberHasMuteRole: false });
            mockClientMock.guilds.fetch.mockResolvedValueOnce(guild);
            dbFindFirstMock.mockResolvedValueOnce({ muteRoleId: 'mute-role' });
            dbSelectLimitMock.mockResolvedValueOnce([makeModerationCase({ action: 'MUTE' })]);

            await processModerationExpirationsOnce();

            expect(dbMock.update).toHaveBeenCalled();
            const setArgs = dbUpdateSetMock.mock.calls[0][0];
            expect(setArgs.active).toBe(false);
        });

        it('inserts an action log entry with success=true after expiration', async () => {
            const { guild } = makeGuild();
            mockClientMock.guilds.fetch.mockResolvedValueOnce(guild);
            dbSelectLimitMock.mockResolvedValueOnce([makeModerationCase({ action: 'BAN' })]);

            await processModerationExpirationsOnce();

            expect(dbMock.insert).toHaveBeenCalled();
            const insertArgs = dbInsertValuesMock.mock.calls[0][0];
            expect(insertArgs.actionType).toBe('BAN_EXPIRED');
            expect(insertArgs.success).toBe(true);
        });

        it('emits a MOD_CASE_EXPIRED_SUCCESS notification after expiration', async () => {
            const { guild } = makeGuild();
            mockClientMock.guilds.fetch.mockResolvedValueOnce(guild);
            dbSelectLimitMock.mockResolvedValueOnce([makeModerationCase({ action: 'BAN' })]);

            await processModerationExpirationsOnce();

            expect(mockEmitNotification).toHaveBeenCalledWith(expect.objectContaining({
                guildId: 'guild-1',
                eventType: 'MOD_CASE_EXPIRED_SUCCESS',
            }));
        });

        it('still marks the case inactive even when the guild cannot be fetched', async () => {
            // expireMuteCase returns early (no throw) when guild fetch fails,
            // so processExpiredCase continues and marks the case inactive.
            mockClientMock.guilds.fetch.mockRejectedValueOnce(new Error('Unknown Guild'));
            dbSelectLimitMock.mockResolvedValueOnce([makeModerationCase({ action: 'MUTE' })]);

            await processModerationExpirationsOnce();

            // The case should still be marked inactive
            expect(dbMock.update).toHaveBeenCalled();
            const setArgs = dbUpdateSetMock.mock.calls[0][0];
            expect(setArgs.active).toBe(false);
        });

        it('still marks the case inactive even when the member cannot be fetched', async () => {
            // expireMuteCase returns early (no throw) when member fetch fails.
            const guild = {
                id: 'guild-1',
                members: {
                    fetch: vi.fn().mockRejectedValueOnce(new Error('Unknown Member')),
                    unban: mockUnban,
                },
            };
            mockClientMock.guilds.fetch.mockResolvedValueOnce(guild);
            dbSelectLimitMock.mockResolvedValueOnce([makeModerationCase({ action: 'MUTE' })]);

            await processModerationExpirationsOnce();

            expect(dbMock.update).toHaveBeenCalled();
            const setArgs = dbUpdateSetMock.mock.calls[0][0];
            expect(setArgs.active).toBe(false);
        });
    });
});
