import { NextRequest, NextResponse } from 'next/server';
import { db, userCalendarIntegration } from '@/lib/db';
import { eq } from 'drizzle-orm';
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

// GET /api/guilds/[guildId]/calendar-integrations - List integrations
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

        // Get integrations for this user that include this guild
        const integrations = await db
            .select()
            .from(userCalendarIntegration)
            .where(eq(userCalendarIntegration.userId, auth.userId));

        // Filter to only show integrations that include this guild
        const filtered = integrations.filter(
            (i) =>
                (
                    !i.includeGuildIds ||
                    i.includeGuildIds.length === 0 ||
                    i.includeGuildIds.includes(guildId)
                ) &&
                !i.excludeGuildIds?.includes(guildId)
        );

        return NextResponse.json(filtered.map(toPublicIntegration));
    } catch (error) {
        logger.error('Error fetching calendar integrations:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
