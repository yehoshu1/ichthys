import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Minimal NextRequest factory: url + method + headers.
function makeRequest(
    url: string,
    method: string,
    headers: Record<string, string> = {}
): NextRequest {
    return new NextRequest(url, { method, headers });
}

describe('requireSameOrigin', () => {
    const ORIGINAL_ENV = { ...process.env };

    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV };
        delete process.env.TRUSTED_ORIGINS;
        delete process.env.NEXTAUTH_URL;
        delete process.env.DASHBOARD_URL;
    });

    afterEach(() => {
        process.env = ORIGINAL_ENV;
    });

    it('allows safe methods regardless of origin', async () => {
        const { requireSameOrigin } = await import('../csrf');
        const req = makeRequest('https://app.example.com/api/x', 'GET', {
            origin: 'https://evil.example',
        });
        expect(requireSameOrigin(req)).toBeNull();
    });

    it('matches a configured TRUSTED_ORIGINS entry', async () => {
        process.env.TRUSTED_ORIGINS = 'https://bot.example.com,https://alt.example.com';
        const { requireSameOrigin } = await import('../csrf');

        const ok = makeRequest('https://bot.example.com/api/x', 'POST', {
            origin: 'https://bot.example.com',
        });
        expect(requireSameOrigin(ok)).toBeNull();

        const bad = makeRequest('https://bot.example.com/api/x', 'POST', {
            origin: 'https://evil.example',
        });
        const res = requireSameOrigin(bad);
        expect(res?.status).toBe(403);
    });

    it('ignores attacker-controlled forwarded headers when allowlist is set', async () => {
        process.env.NEXTAUTH_URL = 'https://bot.example.com';
        const { requireSameOrigin } = await import('../csrf');

        const req = makeRequest('https://bot.example.com/api/x', 'POST', {
            origin: 'https://evil.example',
            'x-forwarded-proto': 'https',
            'x-forwarded-host': 'evil.example',
        });
        const res = requireSameOrigin(req);
        expect(res?.status).toBe(403);
    });

    it('accepts referer fallback when origin is absent', async () => {
        process.env.NEXTAUTH_URL = 'https://bot.example.com';
        const { requireSameOrigin } = await import('../csrf');

        const ok = makeRequest('https://bot.example.com/api/x', 'POST', {
            referer: 'https://bot.example.com/dashboard/123',
        });
        expect(requireSameOrigin(ok)).toBeNull();

        const bad = makeRequest('https://bot.example.com/api/x', 'POST', {
            referer: 'https://evil.example/exploit',
        });
        expect(requireSameOrigin(bad)?.status).toBe(403);
    });

    it('rejects missing origin and referer', async () => {
        process.env.NEXTAUTH_URL = 'https://bot.example.com';
        const { requireSameOrigin } = await import('../csrf');

        const req = makeRequest('https://bot.example.com/api/x', 'POST', {});
        expect(requireSameOrigin(req)?.status).toBe(403);
    });

    it('falls back to forwarded headers when no allowlist is configured (dev mode)', async () => {
        const { requireSameOrigin } = await import('../csrf');

        const ok = makeRequest('https://dev.example/api/x', 'POST', {
            origin: 'https://dev.example',
            'x-forwarded-proto': 'https',
            'x-forwarded-host': 'dev.example',
        });
        expect(requireSameOrigin(ok)).toBeNull();

        const bad = makeRequest('https://dev.example/api/x', 'POST', {
            origin: 'https://other.example',
            'x-forwarded-proto': 'https',
            'x-forwarded-host': 'dev.example',
        });
        expect(requireSameOrigin(bad)?.status).toBe(403);
    });
});
