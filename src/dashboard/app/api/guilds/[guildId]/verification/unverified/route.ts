import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { userJoin } from "@/lib/db";
import { and, desc, eq, isNull } from "drizzle-orm";

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get("limit") || 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 10;

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

        const token = process.env.DISCORD_TOKEN;
        const users = await Promise.all(rows.map(async (row) => {
            let username = `User ${row.userId.slice(0, 4)}...`;
            let avatar: string | null = null;

            if (token) {
                try {
                    const res = await fetch(`https://discord.com/api/v10/users/${row.userId}`, {
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
                userId: row.userId,
                username,
                avatar,
                joinedAt: row.joinedAt
            };
        }));

        return NextResponse.json(users);
    } catch (error) {
        console.error("Error fetching unverified users:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
