import { NextRequest, NextResponse } from 'next/server';
import { db, userCalendarIntegration } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import logger from '@/lib/logger';
import { requireGuildManageAccess } from '@/lib/guild-auth';

function toPublicIntegration(row: typeof userCalendarIntegration.$inferSelect) {
    return {
        id: row.id,
        userId: row.userId,
        provider: row.provider,
        providerAccountId: row.providerAccountId,
        syncEnabled: row.syncEnabled,
        syncDirection: row.syncDirection,
        includeGuildIds: row.includeGuildIds,
        excludeGuildIds: row.excludeGuildIds,
        lastSyncedAt: row.lastSyncedAt,
        lastSyncError: row.lastSyncError,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function normalizeGuildIdList(input: unknown): string[] {
    if (!Array.isArray(input)) {
        return [];
    }

    return Array.from(
        new Set(
            input.filter(
                (value): value is string => typeof value === 'string' && value.trim().length > 0
            )
        )
    );
}

// PATCH /api/guilds/[guildId]/calendar-integrations/[integrationId] - Update integration
export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ guildId: string; integrationId: string }> }
) {
    try {
        const { guildId, integrationId } = await props.params;
        const auth = await requireGuildManageAccess(guildId, request);
        if ('response' in auth) {
            return auth.response;
        }
        const body = await request.json();
        const allowedSyncDirections = new Set(['inbound', 'outbound', 'bidirectional']);

        if (
            body.syncDirection !== undefined &&
            (typeof body.syncDirection !== 'string' || !allowedSyncDirections.has(body.syncDirection))
        ) {
            return NextResponse.json({ error: 'Invalid syncDirection' }, { status: 400 });
        }

        if (body.includeGuildIds !== undefined && !Array.isArray(body.includeGuildIds)) {
            return NextResponse.json({ error: 'includeGuildIds must be an array' }, { status: 400 });
        }

        if (body.excludeGuildIds !== undefined && !Array.isArray(body.excludeGuildIds)) {
            return NextResponse.json({ error: 'excludeGuildIds must be an array' }, { status: 400 });
        }

        // Check if integration exists and belongs to user
        const [existing] = await db
            .select()
            .from(userCalendarIntegration)
            .where(and(
                eq(userCalendarIntegration.id, integrationId),
                eq(userCalendarIntegration.userId, auth.userId)
            ));

        if (!existing) {
            return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
        }

        const includeGuildIds = Array.isArray(body.includeGuildIds)
            ? normalizeGuildIdList(body.includeGuildIds)
            : undefined;
        const excludeGuildIds = Array.isArray(body.excludeGuildIds)
            ? normalizeGuildIdList(body.excludeGuildIds)
            : undefined;

        const [updated] = await db
            .update(userCalendarIntegration)
            .set({
                syncEnabled: typeof body.syncEnabled === 'boolean' ? body.syncEnabled : existing.syncEnabled,
                syncDirection: body.syncDirection ?? existing.syncDirection,
                includeGuildIds: includeGuildIds ?? existing.includeGuildIds,
                excludeGuildIds: excludeGuildIds ?? existing.excludeGuildIds,
                updatedAt: new Date(),
            })
            .where(eq(userCalendarIntegration.id, integrationId))
            .returning();

        return NextResponse.json(toPublicIntegration(updated));
    } catch (error) {
        logger.error('Error updating calendar integration:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/guilds/[guildId]/calendar-integrations/[integrationId] - Delete integration
export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ guildId: string; integrationId: string }> }
) {
    try {
        const { guildId, integrationId } = await props.params;
        const auth = await requireGuildManageAccess(guildId, request);
        if ('response' in auth) {
            return auth.response;
        }

        // Check if integration exists and belongs to user
        const [existing] = await db
            .select()
            .from(userCalendarIntegration)
            .where(and(
                eq(userCalendarIntegration.id, integrationId),
                eq(userCalendarIntegration.userId, auth.userId)
            ));

        if (!existing) {
            return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
        }

        await db.delete(userCalendarIntegration).where(eq(userCalendarIntegration.id, integrationId));

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('Error deleting calendar integration:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
