import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock factories are hoisted to the top of the file, so any variables they
// reference must be declared via vi.hoisted() (which is also hoisted).
const { dbMock, dbSelectWhereMock, mockLogger } = vi.hoisted(() => {
    const dbSelectWhereMock = vi.fn().mockResolvedValue([]);
    const dbSelectFromMock = vi.fn().mockReturnValue({ where: dbSelectWhereMock });
    const dbMock = {
        select: vi.fn().mockReturnValue({ from: dbSelectFromMock }),
    };
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    return { dbMock, dbSelectWhereMock, mockLogger };
});

vi.mock('@shared/database/client', () => ({ db: dbMock }));
vi.mock('@shared/database/schema', () => ({ levelReward: {} }));
vi.mock('../logger', () => ({ default: mockLogger }));

import {
    calculateLevel,
    calculateXpForLevel,
    checkAndAssignLevelRewards,
    xpForLevel,
} from '../leveling';

// ── Pure-function tests ─────────────────────────────────────────────────────

describe('calculateLevel', () => {
    it('returns 0 for 0 XP', () => {
        expect(calculateLevel(0)).toBe(0);
    });

    it('returns 0 for 99 XP (below level-1 threshold)', () => {
        expect(calculateLevel(99)).toBe(0);
    });

    it('returns 1 for exactly 100 XP', () => {
        expect(calculateLevel(100)).toBe(1);
    });

    it('returns 5 for 2500 XP', () => {
        expect(calculateLevel(2500)).toBe(5);
    });

    it('returns 10 for 10000 XP', () => {
        expect(calculateLevel(10000)).toBe(10);
    });

    it('floors fractional results', () => {
        // sqrt(101) ≈ 10.05 → 0.1 * 10.05 ≈ 1.005 → floor = 1
        expect(calculateLevel(101)).toBe(1);
    });
});

describe('calculateXpForLevel', () => {
    it('returns 0 for level 0', () => {
        expect(calculateXpForLevel(0)).toBe(0);
    });

    it('returns 100 for level 1', () => {
        expect(calculateXpForLevel(1)).toBe(100);
    });

    it('returns 2500 for level 5', () => {
        expect(calculateXpForLevel(5)).toBe(2500);
    });

    it('returns 10000 for level 10', () => {
        expect(calculateXpForLevel(10)).toBe(10000);
    });

    it('is the inverse of calculateLevel at threshold values', () => {
        for (const level of [1, 2, 5, 10, 20]) {
            expect(calculateLevel(calculateXpForLevel(level))).toBe(level);
        }
    });
});

describe('xpForLevel', () => {
    it('is an alias for calculateXpForLevel', () => {
        expect(xpForLevel).toBe(calculateXpForLevel);
    });
});

// ── checkAndAssignLevelRewards tests ────────────────────────────────────────

describe('checkAndAssignLevelRewards', () => {
    function makeMember({
        roleIdsInGuild = ['role-1'],
        memberHasRoles = [] as string[],
    } = {}) {
        const roleAdd = vi.fn().mockResolvedValue(undefined);
        const guildRolesCache = new Map(
            roleIdsInGuild.map((id) => [id, { id, name: `Role ${id}` }])
        );
        const member = {
            guild: {
                id: 'guild-1',
                name: 'Test Guild',
                roles: { cache: guildRolesCache },
            },
            user: { tag: 'TestUser#0001' },
            roles: {
                cache: { has: (id: string) => memberHasRoles.includes(id) },
                add: roleAdd,
            },
        };
        return { member, roleAdd };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        dbSelectWhereMock.mockResolvedValue([]);
    });

    it('does nothing when member has no guild', async () => {
        const member = { guild: null, user: { tag: 'NoGuild#0001' } } as any;
        await checkAndAssignLevelRewards(member, 5);
        expect(dbMock.select).not.toHaveBeenCalled();
    });

    it('does nothing when the guild has no configured rewards', async () => {
        const { member, roleAdd } = makeMember();
        dbSelectWhereMock.mockResolvedValueOnce([]);
        await checkAndAssignLevelRewards(member as any, 5);
        expect(roleAdd).not.toHaveBeenCalled();
    });

    it('assigns a role the member does not yet have', async () => {
        const { member, roleAdd } = makeMember({ roleIdsInGuild: ['role-1'] });
        dbSelectWhereMock.mockResolvedValueOnce([{ roleId: 'role-1', level: 1 }]);
        await checkAndAssignLevelRewards(member as any, 1);
        expect(roleAdd).toHaveBeenCalledWith({ id: 'role-1', name: 'Role role-1' });
    });

    it('skips a role the member already has', async () => {
        const { member, roleAdd } = makeMember({
            roleIdsInGuild: ['role-1'],
            memberHasRoles: ['role-1'],
        });
        dbSelectWhereMock.mockResolvedValueOnce([{ roleId: 'role-1', level: 1 }]);
        await checkAndAssignLevelRewards(member as any, 1);
        expect(roleAdd).not.toHaveBeenCalled();
    });

    it('skips a reward whose role no longer exists in the guild', async () => {
        const { member, roleAdd } = makeMember({ roleIdsInGuild: [] });
        dbSelectWhereMock.mockResolvedValueOnce([{ roleId: 'role-1', level: 1 }]);
        await checkAndAssignLevelRewards(member as any, 1);
        expect(roleAdd).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('role-1')
        );
    });

    it('assigns all earned rewards when a member gains multiple levels at once', async () => {
        const { member, roleAdd } = makeMember({
            roleIdsInGuild: ['role-1', 'role-3', 'role-5'],
        });
        dbSelectWhereMock.mockResolvedValueOnce([
            { roleId: 'role-1', level: 1 },
            { roleId: 'role-3', level: 3 },
            { roleId: 'role-5', level: 5 },
        ]);
        await checkAndAssignLevelRewards(member as any, 5);
        expect(roleAdd).toHaveBeenCalledTimes(3);
    });

    it('logs an error and continues when role assignment throws', async () => {
        const { member, roleAdd } = makeMember({ roleIdsInGuild: ['role-1'] });
        roleAdd.mockRejectedValueOnce(new Error('Missing Permissions'));
        dbSelectWhereMock.mockResolvedValueOnce([{ roleId: 'role-1', level: 1 }]);
        await checkAndAssignLevelRewards(member as any, 1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('role-1'),
            expect.any(Error)
        );
    });
});
