import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getClientIp } from '../rate-limit';

function makeRequest(headers: Record<string, string>): NextRequest {
    return new NextRequest('https://app.example.com/api/x', {
        method: 'GET',
        headers,
    });
}

describe('getClientIp trusted-proxy handling', () => {
    const ORIGINAL_ENV = { ...process.env };

    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV };
        delete process.env.TRUST_PROXY_DEPTH;
    });

    afterEach(() => {
        process.env = ORIGINAL_ENV;
    });

    it('ignores x-forwarded-for when no proxy is trusted (direct exposure)', () => {
        const ip = getClientIp(
            makeRequest({ 'x-forwarded-for': '6.6.6.6, 7.7.7.7' })
        );
        // No XFF trust -> real-ip fallback or unknown, never a spoofable value.
        expect(['unknown', '']).toContain(ip);
    });

    it('takes the last XFF entry at depth 1 (single trusted proxy)', () => {
        process.env.TRUST_PROXY_DEPTH = '1';
        const ip = getClientIp(
            makeRequest({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' })
        );
        expect(ip).toBe('10.0.0.1');
    });

    it('takes the second-from-right entry at depth 2 (proxy chain)', () => {
        process.env.TRUST_PROXY_DEPTH = '2';
        const ip = getClientIp(
            makeRequest({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1, 10.0.0.2' })
        );
        expect(ip).toBe('10.0.0.1');
    });

    it('falls back when XFF has fewer entries than trusted proxies', () => {
        process.env.TRUST_PROXY_DEPTH = '3';
        const ip = getClientIp(
            makeRequest({ 'x-forwarded-for': '1.2.3.4' })
        );
        expect(['unknown', '']).toContain(ip);
    });

    it('prefers x-real-ip when XFF trust is disabled', () => {
        const ip = getClientIp(
            makeRequest({ 'x-forwarded-for': '6.6.6.6', 'x-real-ip': '9.9.9.9' })
        );
        expect(ip).toBe('9.9.9.9');
    });
});
