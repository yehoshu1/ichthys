import { NextRequest, NextResponse } from 'next/server';
import { db, apiKey } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import logger from '@/lib/logger';
import crypto from 'crypto';
import { requireGuildManageAccess } from '@/lib/guild-auth';

// Generate a secure API key
function generateApiKey(): string {
    return 'ix_' + crypto.randomBytes(32).toString('hex');
}

// Hash an API key
function hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
}

function toPublicApiKey(row: typeof apiKey.$inferSelect) {
    return {
        id: row.id,
        guildId: row.guildId,
        name: row.name,
        permissions: row.permissions,
        createdBy: row.createdBy,
        enabled: row.enabled,
        lastUsedAt: row.lastUsedAt,
        useCount: row.useCount,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

// GET /api/guilds/[guildId]/api-keys - List API keys
export async function GET(
    request: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    try {
        const { guildId: guildIdRaw } = await props.params;
        if (!guildIdRaw) {
            return NextResponse.json({ error: 'Guild ID is required' }, { status: 400 });
        }
        const guildId = guildIdRaw;
        const auth = await requireGuildManageAccess(guildId, request);
        if ('response' in auth) {
            return auth.response;
        }

        const keys = await db
            .select()
            .from(apiKey)
            .where(eq(apiKey.guildId, guildId))
            .orderBy(desc(apiKey.createdAt));

        return NextResponse.json(keys.map(toPublicApiKey));
    } catch (error) {
        logger.error('Error fetching API keys:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/guilds/[guildId]/api-keys - Create API key
export async function POST(
    request: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    try {
        const { guildId: guildIdRaw } = await props.params;
        if (!guildIdRaw) {
            return NextResponse.json({ error: 'Guild ID is required' }, { status: 400 });
        }
        const guildId = guildIdRaw;
        const auth = await requireGuildManageAccess(guildId, request);
        if ('response' in auth) {
            return auth.response;
        }

        const body = await request.json();

        if (!body.name || !body.permissions?.length) {
            return NextResponse.json(
                { error: 'Name and permissions are required' },
                { status: 400 }
            );
        }

        // Generate key (only shown once)
        const key = generateApiKey();
        const keyHash = hashApiKey(key);

        const [created] = await db
            .insert(apiKey)
            .values({
                guildId: guildId as string,
                name: body.name as string,
                keyHash: keyHash,
                permissions: body.permissions as string[],
                createdBy: auth.userId,
                enabled: true,
                expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
            })
            .returning();

        // Return the key only once
        return NextResponse.json({
            ...toPublicApiKey(created),
            key,
        });
    } catch (error) {
        logger.error('Error creating API key:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
