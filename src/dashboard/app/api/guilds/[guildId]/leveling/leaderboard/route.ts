import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { levelProfile } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

async function fetchDiscordUser(userId: string, accessToken: string) {
    try {
        const res = await fetch(`https://discord.com/api/v10/users/${userId}`, {
            headers: {
                Authorization: `Bot ${process.env.DISCORD_TOKEN}`
            }
        });
        if (res.ok) {
            const user = await res.json();
            return {
                username: user.global_name || user.username,
                avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png` : null
            };
        }
    } catch (e) {
        console.error(`Failed to fetch user ${userId}:`, e);
    }
    return { username: null, avatar: null };
}

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type") || "total";

        let orderBy = desc(levelProfile.totalXp);
        if (type === "text") orderBy = desc(levelProfile.textXp);
        else if (type === "voice") orderBy = desc(levelProfile.voiceXp);

        const leaderboard = await db.select({
            userId: levelProfile.userId,
            level: levelProfile.level,
            totalXp: levelProfile.totalXp,
            textXp: levelProfile.textXp,
            voiceXp: levelProfile.voiceXp,
            totalVoiceMinutes: levelProfile.totalVoiceMinutes
        })
            .from(levelProfile)
            .where(eq(levelProfile.guildId, guildId))
            .orderBy(orderBy)
            .limit(50);

        // Fetch usernames from Discord API
        const enrichedLeaderboard = await Promise.all(
            leaderboard.map(async (entry) => {
                const discordUser = await fetchDiscordUser(entry.userId, "");
                return {
                    ...entry,
                    username: discordUser.username || `User ${entry.userId.slice(-4)}`,
                    avatar: discordUser.avatar
                };
            })
        );

        return NextResponse.json(enrichedLeaderboard);
    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
