import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { levelProfile } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import { getDiscordUsers } from "@/lib/discord-user-cache";
import logger from "@/lib/logger";

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

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

        const users = await getDiscordUsers(leaderboard.map((entry) => entry.userId));
        const enrichedLeaderboard = leaderboard.map((entry) => {
            const user = users.get(entry.userId);
            return {
                ...entry,
                username: user?.globalName || user?.username || `User ${entry.userId.slice(-4)}`,
                avatar: user?.avatarUrl || null,
            };
        });

        return NextResponse.json(enrichedLeaderboard);
    } catch (error) {
        logger.error("Error fetching leaderboard", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
