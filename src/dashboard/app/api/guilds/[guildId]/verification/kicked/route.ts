import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { actionLog } from "@/lib/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import { clampLimit } from "@/lib/validation";
import { getDiscordUsers } from "@/lib/discord-user-cache";
import logger from "@/lib/logger";

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const auth = await requireGuildManageAccess(params.guildId, req);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(req.url);
    const limit = clampLimit(searchParams.get("limit"), 10, 1, 50);

    try {
        const kicks = await db
            .select({
                targetUserId: actionLog.targetUserId,
                executedAt: actionLog.executedAt,
                metadata: actionLog.metadata
            })
            .from(actionLog)
            .where(and(
                eq(actionLog.guildId, params.guildId),
                eq(actionLog.actionType, "KICK"),
                sql`${actionLog.metadata}::text like ${'%Unverified Auto-Kick%'}`
            ))
            .orderBy(desc(actionLog.executedAt))
            .limit(limit);

        const usersMap = await getDiscordUsers(kicks.map((kick) => kick.targetUserId));
        const members = kicks.map((kick) => {
            const user = usersMap.get(kick.targetUserId);
            return {
                userId: kick.targetUserId,
                username: user?.globalName || user?.username || `User ${kick.targetUserId.slice(0, 4)}...`,
                avatar: user?.avatarUrl || null,
                executedAt: kick.executedAt,
            };
        });

        return NextResponse.json(members);
    } catch (error) {
        logger.error("Error fetching auto-kicked users", { error: error instanceof Error ? error.message : String(error), guildId: params.guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
