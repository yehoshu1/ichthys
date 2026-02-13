import crypto from 'crypto';

const PREFIX = 'enc:v1:';

function getKey(): Buffer {
    const raw = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
    if (!raw || raw.trim().length < 16) {
        throw new Error('CALENDAR_TOKEN_ENCRYPTION_KEY is required and must be at least 16 characters');
    }
    return crypto.createHash('sha256').update(raw).digest();
}

export function encryptCalendarToken(token: string): string {
    const key = getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

export function decryptCalendarToken(value: string | null | undefined): string | null {
    if (!value) return null;
    if (!value.startsWith(PREFIX)) return value;

    const payload = value.slice(PREFIX.length);
    const [ivHex, cipherHex, tagHex] = payload.split(':');
    if (!ivHex || !cipherHex || !tagHex) return null;

    try {
        const key = getKey();
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
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
