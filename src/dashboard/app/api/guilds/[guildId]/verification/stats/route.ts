import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { userJoin } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";

async function checkAuth(req: NextRequest, guildId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;
    return session;
}

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const session = await checkAuth(req, guildId);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        // Stats: Verified vs Unverified vs Kicked
        const stats = await db.select({
            status: sql<string>`
                CASE 
                    WHEN ${userJoin.kickedAt} IS NOT NULL THEN 'kicked'
                    WHEN ${userJoin.isVerified} = 1 THEN 'verified'
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
                WHEN ${userJoin.isVerified} = 1 THEN 'verified'
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
        console.error("Error fetching verification stats:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
