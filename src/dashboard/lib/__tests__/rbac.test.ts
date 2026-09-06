import { describe, expect, it, vi } from 'vitest';

vi.mock('@shared/database/client', () => ({
    db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
    pool: {},
}));

import { isHardBypassUser, resolveDefaultModuleAccess } from '../rbac';

describe('rbac default access semantics', () => {
    it('treats a Manage Server user as a hard-bypass user', () => {
        expect(
            isHardBypassUser({
                id: '123',
                owner: false,
                permissions: String(0x20n),
            })
        ).toBe(true);
    });

    it('does not treat a regular guild member as a hard-bypass user', () => {
        expect(
            isHardBypassUser({
                id: '123',
                owner: false,
                permissions: '0',
            })
        ).toBe(false);
    });

    it('grants fallback access for hard-bypass users when default access is manage_guild_only', () => {
        expect(
            resolveDefaultModuleAccess('manage_guild_only', {
                id: '123',
                owner: false,
                permissions: String(0x20n),
            })
        ).toEqual({ view: true, edit: true });
    });

    it('denies fallback access for regular members when default access is manage_guild_only', () => {
        expect(
            resolveDefaultModuleAccess('manage_guild_only', {
                id: '123',
                owner: false,
                permissions: '0',
            })
        ).toEqual({ view: false, edit: false });
    });

    it('denies fallback access when default access is deny', () => {
        expect(
            resolveDefaultModuleAccess('deny', {
                id: '123',
                owner: true,
                permissions: String(0x20n),
            })
        ).toEqual({ view: false, edit: false });
    });
});
