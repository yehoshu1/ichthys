import crypto from 'crypto';
import dns from 'dns/promises';
import net from 'net';

const WEBHOOK_SECRET_PREFIX = 'enc:v1:';
const LEGACY_SHA256_HEX = /^[a-f0-9]{64}$/i;

function normalizeIpv4MappedIpv6(address: string): string {
    if (address.startsWith('::ffff:')) {
        return address.slice(7);
    }
    return address;
}

function isPrivateIpv4(address: string): boolean {
    const parts = address.split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
        return true;
    }

    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true; // Multicast + reserved ranges.

    return false;
}

function isPrivateIpv6(address: string): boolean {
    const lower = address.toLowerCase();
    if (lower === '::1') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
    if (lower.startsWith('fe80')) return true; // Link-local
    if (lower.startsWith('ff')) return true; // Multicast
    if (lower === '::') return true;
    return false;
}

export function isPrivateIpAddress(addressInput: string): boolean {
    const address = normalizeIpv4MappedIpv6(addressInput.trim().toLowerCase());
    const kind = net.isIP(address);

    if (kind === 4) {
        return isPrivateIpv4(address);
    }
    if (kind === 6) {
        return isPrivateIpv6(address);
    }

    // Non-IP hostnames are handled via DNS resolution separately.
    if (address === 'localhost') {
        return true;
    }
    return false;
}

export async function validateWebhookUrl(urlInput: string): Promise<{ ok: true } | { ok: false; error: string }> {
    let url: URL;
    try {
        url = new URL(urlInput);
    } catch {
        return { ok: false, error: 'Invalid URL' };
    }

    if (url.protocol !== 'https:') {
        return { ok: false, error: 'Webhook URL must use HTTPS for security' };
    }

    if (url.username || url.password) {
        return { ok: false, error: 'Webhook URL must not include credentials' };
    }

    if (isPrivateIpAddress(url.hostname)) {
        return { ok: false, error: 'Private IP addresses and localhost are not allowed' };
    }

    try {
        const answers = await dns.lookup(url.hostname, { all: true, verbatim: true });
        if (answers.length === 0) {
            return { ok: false, error: 'Could not resolve webhook hostname' };
        }

        for (const answer of answers) {
            if (isPrivateIpAddress(answer.address)) {
                return { ok: false, error: 'Resolved webhook host points to a private network address' };
            }
        }
    } catch {
        return { ok: false, error: 'Could not resolve webhook hostname' };
    }

    return { ok: true };
}

function deriveEncryptionKey(): Buffer {
    const source = process.env.WEBHOOK_SECRET_ENCRYPTION_KEY || process.env.WEBHOOK_SECRET_ENC_KEY;
    if (!source || source.trim().length < 16) {
        throw new Error('WEBHOOK_SECRET_ENCRYPTION_KEY is required and must be at least 16 characters');
    }
    return crypto.createHash('sha256').update(source).digest();
}

export function encryptWebhookSecret(secret: string): string {
    const key = deriveEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${WEBHOOK_SECRET_PREFIX}${iv.toString('hex')}:${ciphertext.toString('hex')}:${tag.toString('hex')}`;
}

export function decryptWebhookSecret(storedSecret: string | null | undefined): string | null {
    if (!storedSecret) {
        return null;
    }

    if (storedSecret.startsWith(WEBHOOK_SECRET_PREFIX)) {
        const payload = storedSecret.slice(WEBHOOK_SECRET_PREFIX.length);
        const [ivHex, cipherHex, tagHex] = payload.split(':');
        if (!ivHex || !cipherHex || !tagHex) {
            return null;
        }

        try {
            const key = deriveEncryptionKey();
            const decipher = crypto.createDecipheriv(
                'aes-256-gcm',
                key,
                Buffer.from(ivHex, 'hex')
            );
            decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
            const decrypted = Buffer.concat([
                decipher.update(Buffer.from(cipherHex, 'hex')),
                decipher.final(),
            ]);
            return decrypted.toString('utf8');
        } catch {
            return null;
        }
    }

    // Legacy hashed values cannot be used as real HMAC secrets.
    if (LEGACY_SHA256_HEX.test(storedSecret)) {
        return null;
    }

    // Legacy plaintext fallback from previous versions.
    return storedSecret;
}

export function maskSecretForResponse(secret: string | null | undefined): string | null {
    return secret ? '__configured__' : null;
}
