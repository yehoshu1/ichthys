import { NextRequest, NextResponse } from 'next/server';
import { db, apiKey } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import logger from '@/lib/logger';
import { z } from 'zod';
import { requireGuildManageAccess } from '@/lib/guild-auth';
import { parseJsonBody } from '@/lib/validation';

const updateApiKeySchema = z.object({
    enabled: z.boolean(),
}).strict();

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

// PATCH /api/guilds/[guildId]/api-keys/[keyId] - Update API key
export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ guildId: string; keyId: string }> }
) {
    try {
        const { guildId, keyId } = await props.params;
        const auth = await requireGuildManageAccess(guildId, request);
        if ('response' in auth) {
            return auth.response;
        }
        const parsed = await parseJsonBody(request, updateApiKeySchema);
        if (!parsed.success) return parsed.response;
        const body = parsed.data;

        // Check if key exists
        const [existing] = await db
            .select()
            .from(apiKey)
            .where(and(
                eq(apiKey.id, keyId),
                eq(apiKey.guildId, guildId)
            ));

        if (!existing) {
            return NextResponse.json({ error: 'API key not found' }, { status: 404 });
        }

        const [updated] = await db
            .update(apiKey)
            .set({
                enabled: body.enabled,
                updatedAt: new Date(),
            })
            .where(eq(apiKey.id, keyId))
            .returning();

        return NextResponse.json(toPublicApiKey(updated));
    } catch (error) {
        logger.error('Error updating API key:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/guilds/[guildId]/api-keys/[keyId] - Delete API key
export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ guildId: string; keyId: string }> }
) {
    try {
        const { guildId, keyId } = await props.params;
        const auth = await requireGuildManageAccess(guildId, request);
        if ('response' in auth) {
            return auth.response;
        }

        // Check if key exists
        const [existing] = await db
            .select()
            .from(apiKey)
            .where(and(
                eq(apiKey.id, keyId),
                eq(apiKey.guildId, guildId)
            ));

        if (!existing) {
            return NextResponse.json({ error: 'API key not found' }, { status: 404 });
        }

        await db.delete(apiKey).where(eq(apiKey.id, keyId));

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('Error deleting API key:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
