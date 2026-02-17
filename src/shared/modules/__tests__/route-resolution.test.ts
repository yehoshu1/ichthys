import { describe, expect, it } from 'vitest';
import { resolveModuleForApiPath } from '../route-resolution';

describe('module route resolution', () => {
    it('resolves module routes by longest prefix match', () => {
        expect(resolveModuleForApiPath('/api/guilds/123/events')).toBe('events');
        expect(resolveModuleForApiPath('/api/guilds/123/events/templates/template-1')).toBe('events');
        expect(resolveModuleForApiPath('/api/guilds/123/polls/abc')).toBe('polls');
        expect(resolveModuleForApiPath('/api/guilds/123/welcome/config')).toBe('welcome');
    });

    it('resolves core-only routes', () => {
        expect(resolveModuleForApiPath('/api/guilds/123')).toBe('core');
        expect(resolveModuleForApiPath('/api/guilds/123/modules')).toBe('core');
    });

    it('returns null for unclaimed API paths', () => {
        expect(resolveModuleForApiPath('/api/health')).toBeNull();
        expect(resolveModuleForApiPath('/api/guilds')).toBeNull();
    });
});
