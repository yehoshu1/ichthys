import { describe, expect, it } from 'vitest';
import {
    MODULE_IDS,
    MODULE_MANIFESTS,
    resolveModuleForCommand,
    isValidModuleId,
} from '../registry';

describe('module registry', () => {
    it('has unique module ids', () => {
        const unique = new Set(MODULE_IDS);
        expect(unique.size).toBe(MODULE_IDS.length);
    });

    it('has unique command assignments', () => {
        const seen = new Set<string>();

        for (const manifest of MODULE_MANIFESTS) {
            for (const commandId of manifest.commandIds) {
                expect(seen.has(commandId)).toBe(false);
                seen.add(commandId);
            }
        }
    });

    it('resolves known commands to module ids', () => {
        expect(resolveModuleForCommand('poll')).toBe('polls');
        expect(resolveModuleForCommand('create')).toBe('events');
        expect(resolveModuleForCommand('clear')).toBe('moderation');
        expect(resolveModuleForCommand('verify')).toBe('verification');
        expect(resolveModuleForCommand('module')).toBe('core');
    });

    it('falls back to core for unknown commands', () => {
        expect(resolveModuleForCommand('nonexistent')).toBe('core');
    });

    it('validates module ids correctly', () => {
        expect(isValidModuleId('events')).toBe(true);
        expect(isValidModuleId('polls')).toBe(true);
        expect(isValidModuleId('made_up')).toBe(false);
    });
});
