import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userJoin } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import logger from "@/lib/logger";

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        // Stats: Verified vs Unverified vs Kicked
        const stats = await db.select({
            status: sql<string>`
                CASE 
                    WHEN ${userJoin.kickedAt} IS NOT NULL THEN 'kicked'
                    WHEN ${userJoin.isVerified} = true THEN 'verified'
                    ELSE 'unverified'
                END
            `,
            count: sql<number>`count(*)`
        })
            .from(userJoin)
            .where(and(
                eq(userJoin.guildId, guildId),
                eq(userJoin.isBot, false)
            ))
            .groupBy(sql`CASE 
                WHEN ${userJoin.kickedAt} IS NOT NULL THEN 'kicked'
                WHEN ${userJoin.isVerified} = true THEN 'verified'
                ELSE 'unverified'
            END`);

        const result = {
            verified: 0,
            unverified: 0,
            kicked: 0
        };

        stats.forEach(s => {
            if (s.status === 'verified') result.verified = Number(s.count);
            if (s.status === 'unverified') result.unverified = Number(s.count);
            if (s.status === 'kicked') result.kicked = Number(s.count);
        });

        return NextResponse.json(result);
    } catch (error) {
        logger.error("Error fetching verification stats", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
