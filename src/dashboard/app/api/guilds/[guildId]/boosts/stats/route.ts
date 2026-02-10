import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userBoost } from "@/lib/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import logger from "@/lib/logger";

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const currentBoosters = await db.query.userBoost.findMany({
            where: eq(userBoost.guildId, guildId),
            orderBy: [desc(userBoost.boostedAt)]
        });

        const aggregate = await db
            .select({
                totalHistorical: sql<number>`count(*)`,
                activeCount: sql<number>`sum(case when ${userBoost.roleRemoved} = 0 then 1 else 0 end)`,
                totalBoosts: sql<number>`sum(${userBoost.boostCountTotal})`,
            })
            .from(userBoost)
            .where(eq(userBoost.guildId, guildId));

        const stats = aggregate[0] ?? { activeCount: 0, totalHistorical: 0, totalBoosts: 0 };

        return NextResponse.json({
            boosters: currentBoosters,
            stats: {
                activeCount: Number(stats.activeCount) || 0,
                totalHistorical: Number(stats.totalHistorical) || 0,
                totalBoosts: Number(stats.totalBoosts) || 0
            }
        });
    } catch (error) {
        logger.error("Error fetching boost stats", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
