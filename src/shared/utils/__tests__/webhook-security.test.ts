import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// dns/promises is mocked so tests run without network access.
// vi.hoisted() ensures the mock reference is initialized before vi.mock() runs.
const { dnsLookupMock } = vi.hoisted(() => ({
    dnsLookupMock: vi.fn(),
}));

vi.mock('dns/promises', () => ({ default: { lookup: dnsLookupMock } }));

import {
    decryptWebhookSecret,
    encryptWebhookSecret,
    isPrivateIpAddress,
    maskSecretForResponse,
    validateWebhookUrl,
} from '../webhook-security';

// ── isPrivateIpAddress ───────────────────────────────────────────────────────

describe('isPrivateIpAddress', () => {
    describe('private IPv4 ranges', () => {
        it.each([
            ['10.0.0.1', true],
            ['10.255.255.255', true],
            ['127.0.0.1', true],
            ['127.1.2.3', true],
            ['0.0.0.1', true],
            ['169.254.0.1', true],      // link-local
            ['172.16.0.1', true],       // 172.16-31 private
            ['172.31.255.255', true],
            ['192.168.0.1', true],
            ['192.168.100.200', true],
            ['224.0.0.1', true],        // multicast
            ['255.255.255.255', true],  // reserved
        ])('%s → %s', (ip, expected) => {
            expect(isPrivateIpAddress(ip)).toBe(expected);
        });
    });

    describe('public IPv4 addresses', () => {
        it.each([
            ['8.8.8.8'],
            ['1.1.1.1'],
            ['172.15.255.255'],   // just below the private 172.16 range
            ['172.32.0.1'],       // just above the private 172.31 range
            ['192.167.1.1'],
        ])('%s is public', (ip) => {
            expect(isPrivateIpAddress(ip)).toBe(false);
        });
    });

    describe('private IPv6 addresses', () => {
        it.each([
            ['::1'],              // loopback
            ['fc00::1'],         // ULA
            ['fd12:3456::1'],    // ULA
            ['fe80::1'],         // link-local
            ['ff02::1'],         // multicast
            ['::'],              // unspecified
        ])('%s → true', (ip) => {
            expect(isPrivateIpAddress(ip)).toBe(true);
        });
    });

    describe('public IPv6 addresses', () => {
        it.each([
            ['2001:db8::1'],
            ['2606:4700::1'],
        ])('%s is public', (ip) => {
            expect(isPrivateIpAddress(ip)).toBe(false);
        });
    });

    describe('IPv4-mapped IPv6 (::ffff: prefix)', () => {
        it('treats ::ffff:192.168.1.1 as private', () => {
            expect(isPrivateIpAddress('::ffff:192.168.1.1')).toBe(true);
        });

        it('treats ::ffff:8.8.8.8 as public', () => {
            expect(isPrivateIpAddress('::ffff:8.8.8.8')).toBe(false);
        });
    });

    it('treats "localhost" as private', () => {
        expect(isPrivateIpAddress('localhost')).toBe(true);
    });
});

// ── validateWebhookUrl ───────────────────────────────────────────────────────

describe('validateWebhookUrl', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects non-HTTPS URLs', async () => {
        const result = await validateWebhookUrl('http://example.com/hook');
        expect(result).toEqual({ ok: false, error: expect.stringContaining('HTTPS') });
    });

    it('rejects invalid URLs', async () => {
        const result = await validateWebhookUrl('not-a-url');
        expect(result).toEqual({ ok: false, error: 'Invalid URL' });
    });

    it('rejects URLs containing credentials', async () => {
        const result = await validateWebhookUrl('https://user:pass@example.com/hook');
        expect(result).toEqual({ ok: false, error: expect.stringContaining('credentials') });
    });

    it('rejects URLs whose hostname is a private IP', async () => {
        const result = await validateWebhookUrl('https://192.168.1.1/hook');
        expect(result.ok).toBe(false);
        expect((result as any).error.toLowerCase()).toContain('private');
    });

    it('rejects URLs whose hostname resolves to a private IP', async () => {
        dnsLookupMock.mockResolvedValueOnce([{ address: '10.0.0.1' }]);
        const result = await validateWebhookUrl('https://internal.example.com/hook');
        expect(result).toEqual({ ok: false, error: expect.stringContaining('private network') });
    });

    it('rejects when DNS lookup fails', async () => {
        dnsLookupMock.mockRejectedValueOnce(new Error('NXDOMAIN'));
        const result = await validateWebhookUrl('https://no-such-host.example.com/hook');
        expect(result).toEqual({ ok: false, error: expect.stringContaining('resolve') });
    });

    it('rejects when DNS returns no answers', async () => {
        dnsLookupMock.mockResolvedValueOnce([]);
        const result = await validateWebhookUrl('https://empty-dns.example.com/hook');
        expect(result).toEqual({ ok: false, error: expect.stringContaining('resolve') });
    });

    it('accepts a valid HTTPS URL resolving to a public IP', async () => {
        dnsLookupMock.mockResolvedValueOnce([{ address: '93.184.216.34' }]);
        const result = await validateWebhookUrl('https://example.com/webhook');
        expect(result).toEqual({ ok: true });
    });
});

// ── encrypt / decrypt ────────────────────────────────────────────────────────

describe('encryptWebhookSecret / decryptWebhookSecret', () => {
    const ENV_KEY = 'WEBHOOK_SECRET_ENCRYPTION_KEY';
    const TEST_KEY = 'test-encryption-key-32chars-long!!';

    beforeEach(() => {
        process.env[ENV_KEY] = TEST_KEY;
    });

    afterEach(() => {
        delete process.env[ENV_KEY];
    });

    it('encrypts a secret and decrypts it back to the original value', () => {
        const original = 'my-super-secret-webhook-token';
        const encrypted = encryptWebhookSecret(original);
        expect(encrypted).toMatch(/^enc:v1:/);
        expect(decryptWebhookSecret(encrypted)).toBe(original);
    });

    it('produces different ciphertexts for the same plaintext (random IV)', () => {
        const secret = 'same-secret';
        const first = encryptWebhookSecret(secret);
        const second = encryptWebhookSecret(secret);
        expect(first).not.toBe(second);
        expect(decryptWebhookSecret(first)).toBe(secret);
        expect(decryptWebhookSecret(second)).toBe(secret);
    });

    it('encrypts and decrypts secrets with special characters', () => {
        const secret = 'tok€n with üñícode & symbols: <>"\'/\\';
        expect(decryptWebhookSecret(encryptWebhookSecret(secret))).toBe(secret);
    });

    it('throws when the encryption key is missing', () => {
        delete process.env[ENV_KEY];
        expect(() => encryptWebhookSecret('secret')).toThrow();
    });

    it('throws when the encryption key is too short', () => {
        process.env[ENV_KEY] = 'short';
        expect(() => encryptWebhookSecret('secret')).toThrow();
    });

    describe('decryptWebhookSecret edge cases', () => {
        it('returns null for null input', () => {
            expect(decryptWebhookSecret(null)).toBeNull();
        });

        it('returns null for undefined input', () => {
            expect(decryptWebhookSecret(undefined)).toBeNull();
        });

        it('returns null for empty string', () => {
            expect(decryptWebhookSecret('')).toBeNull();
        });

        it('returns null for a malformed enc:v1: payload', () => {
            expect(decryptWebhookSecret('enc:v1:notvalid')).toBeNull();
        });

        it('returns null for a legacy SHA-256 hex hash (64 hex chars)', () => {
            const legacyHash = 'a'.repeat(64);
            expect(decryptWebhookSecret(legacyHash)).toBeNull();
        });

        it('returns the value as-is for a legacy plaintext secret', () => {
            expect(decryptWebhookSecret('plain-legacy-secret')).toBe('plain-legacy-secret');
        });

        it('returns null when decryption fails due to tampered ciphertext', () => {
            const encrypted = encryptWebhookSecret('original');
            // Corrupt the ciphertext portion (index 3 in the colon-split payload)
            const parts = encrypted.split(':');
            parts[3] = 'deadbeef';
            const corrupted = parts.join(':');
            expect(decryptWebhookSecret(corrupted)).toBeNull();
        });
    });
});

// ── maskSecretForResponse ────────────────────────────────────────────────────

describe('maskSecretForResponse', () => {
    it('returns "__configured__" for a non-null, non-empty secret', () => {
        expect(maskSecretForResponse('any-secret')).toBe('__configured__');
    });

    it('returns null for a null secret', () => {
        expect(maskSecretForResponse(null)).toBeNull();
    });

    it('returns null for an undefined secret', () => {
        expect(maskSecretForResponse(undefined)).toBeNull();
    });
});
