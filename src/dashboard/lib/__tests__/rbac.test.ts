import { describe, expect, it, vi } from 'vitest';

vi.mock('@shared/database/client', () => ({
    db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
    pool: {},
}));

import {
    isHardBypassUser,
    isManageGuildUser,
    resolveDefaultModuleAccess,
    resolveTrustTier,
    getUserRolesForRules,
} from '../rbac';
import { RBAC_MODULE_IDS } from '../rbac-modules';
import { MODULE_IDS } from '@shared/modules/registry';

const OWNER = { id: '1', owner: true, permissions: '0' };
const ADMIN = { id: '1', owner: false, permissions: String(0x8n) };
const MANAGER = { id: '1', owner: false, permissions: String(0x20n) };
const MEMBER = { id: '1', owner: false, permissions: '0' };

describe('trust tiers', () => {
    it('classifies owner and administrator as bypass', () => {
        expect(resolveTrustTier(OWNER)).toBe('bypass');
        expect(resolveTrustTier(ADMIN)).toBe('bypass');
    });

    it('classifies Manage Server holders as the manage tier', () => {
        expect(resolveTrustTier(MANAGER)).toBe('manage');
    });

    it('classifies regular members as the member tier', () => {
        expect(resolveTrustTier(MEMBER)).toBe('member');
        expect(resolveTrustTier(undefined)).toBe('member');
    });

    it('isHardBypassUser no longer includes Manage Server holders', () => {
        expect(isHardBypassUser(MANAGER)).toBe(false);
        expect(isHardBypassUser(OWNER)).toBe(true);
        expect(isHardBypassUser(ADMIN)).toBe(true);
        expect(isHardBypassUser(MEMBER)).toBe(false);
        expect(isHardBypassUser(undefined)).toBe(false);
    });

    it('isManageGuildUser includes Manage Server holders', () => {
        expect(isManageGuildUser(MANAGER)).toBe(true);
        expect(isManageGuildUser(ADMIN)).toBe(true);
        expect(isManageGuildUser(MEMBER)).toBe(false);
    });
});

describe('rbac default access semantics', () => {
    it('bypass users get full fallback access regardless of setting', () => {
        expect(resolveDefaultModuleAccess('manage_guild_only', OWNER)).toEqual({ view: true, edit: true });
        expect(resolveDefaultModuleAccess('deny', OWNER)).toEqual({ view: true, edit: true });
        expect(resolveDefaultModuleAccess('deny', ADMIN)).toEqual({ view: true, edit: true });
    });

    it('manage tier gets fallback access only when default is manage_guild_only', () => {
        expect(resolveDefaultModuleAccess('manage_guild_only', MANAGER)).toEqual({ view: true, edit: true });
        expect(resolveDefaultModuleAccess('deny', MANAGER)).toEqual({ view: false, edit: false });
    });

    it('members never get fallback access', () => {
        expect(resolveDefaultModuleAccess('manage_guild_only', MEMBER)).toEqual({ view: false, edit: false });
        expect(resolveDefaultModuleAccess('deny', MEMBER)).toEqual({ view: false, edit: false });
    });

    it('denies fallback access when guild info is missing', () => {
        expect(resolveDefaultModuleAccess('manage_guild_only', undefined)).toEqual({ view: false, edit: false });
    });
});

describe('@everyone role injection', () => {
    it('includes the guild id as the @everyone role', () => {
        expect(getUserRolesForRules('111222333444555666', ['999888777666555444'])).toEqual([
            '111222333444555666',
            '999888777666555444',
        ]);
    });
});

describe('RBAC module ID derivation', () => {
    it('contains every expected module', () => {
        for (const expected of [
            'welcome',
            'verification',
            'leveling',
            'boosts',
            'birthdays',
            'role-actions',
            'aliases',
            'commands',
            'moderation',
            'settings',
            'webhooks',
            'events',
            'polls',
            'notifications',
            'analytics',
        ]) {
            expect(RBAC_MODULE_IDS).toContain(expected);
        }
    });

    it('never contains core or registry-underscore ids', () => {
        expect(RBAC_MODULE_IDS).not.toContain('core');
        expect(RBAC_MODULE_IDS).not.toContain('role_actions');
        expect(RBAC_MODULE_IDS).not.toContain('settings_backups');
    });

    it('stays in sync with the shared registry (every non-core manifest has an RBAC module)', () => {
        for (const manifestId of MODULE_IDS) {
            if (manifestId === 'core') continue;
            const apiId = manifestId === 'settings_backups' ? 'settings' : manifestId.replace(/_/g, '-');
            expect(RBAC_MODULE_IDS).toContain(apiId);
        }
    });
});
