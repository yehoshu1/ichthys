import { describe, expect, it } from 'vitest';
import { getCanonicalCommandIds, getCanonicalCommandIdSet } from '../command-catalog';

describe('command catalog', () => {
    it('includes key commands expected by runtime features', () => {
        const ids = getCanonicalCommandIds();

        expect(ids).toContain('create');
        expect(ids).toContain('poll');
        expect(ids).toContain('settings');
        expect(ids).toContain('timestamp');
    });

    it('returns a command id set consistent with the id list', () => {
        const ids = getCanonicalCommandIds();
        const idSet = getCanonicalCommandIdSet();

        for (const id of ids) {
            expect(idSet.has(id)).toBe(true);
        }
    });
});
