import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userJoin } from "@/lib/db";
import { and, desc, eq, isNull } from "drizzle-orm";
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
        const rows = await db
            .select({
                userId: userJoin.userId,
                joinedAt: userJoin.joinedAt
            })
            .from(userJoin)
            .where(and(
                eq(userJoin.guildId, params.guildId),
                eq(userJoin.isVerified, false),
                eq(userJoin.isBot, false),
                isNull(userJoin.kickedAt)
            ))
            .orderBy(desc(userJoin.joinedAt))
            .limit(limit);

        const usersMap = await getDiscordUsers(rows.map((row) => row.userId));
        const users = rows.map((row) => {
            const user = usersMap.get(row.userId);
            return {
                userId: row.userId,
                username: user?.globalName || user?.username || `User ${row.userId.slice(0, 4)}...`,
                avatar: user?.avatarUrl || null,
                joinedAt: row.joinedAt,
            };
        });

        return NextResponse.json(users);
    } catch (error) {
        logger.error("Error fetching unverified users", { error: error instanceof Error ? error.message : String(error), guildId: params.guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
