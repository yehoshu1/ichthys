import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { actionLog } from "@/lib/db";
import { and, desc, eq, sql } from "drizzle-orm";

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get("limit") || 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 10;

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
                sql`${actionLog.metadata} like ${'%Unverified Auto-Kick%'}`
            ))
            .orderBy(desc(actionLog.executedAt))
            .limit(limit);

        const token = process.env.DISCORD_TOKEN;
        const members = await Promise.all(kicks.map(async (kick) => {
            let username = `User ${kick.targetUserId.slice(0, 4)}...`;
            let avatar: string | null = null;

            if (token) {
                try {
                    const res = await fetch(`https://discord.com/api/v10/users/${kick.targetUserId}`, {
                        headers: { Authorization: `Bot ${token}` }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        username = data.username || username;
                        avatar = data.avatar
                            ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
                            : null;
                    }
                } catch (error) {
                    // Ignore lookup errors and fall back to ID.
                }
            }

            return {
                userId: kick.targetUserId,
                username,
                avatar,
                executedAt: kick.executedAt
            };
        }));

        return NextResponse.json(members);
    } catch (error) {
        console.error("Error fetching auto-kicked users:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
