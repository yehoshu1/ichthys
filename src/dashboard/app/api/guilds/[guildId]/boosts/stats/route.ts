import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { userBoost } from "@/lib/db";
import { eq, desc, sql } from "drizzle-orm";

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
        // Fetch current boosters (active)
        const currentBoosters = await db.query.userBoost.findMany({
            where: eq(userBoost.guildId, guildId),
            orderBy: [desc(userBoost.boostedAt)]
        });

        // Calculate some basic stats
        const activeCount = currentBoosters.filter(b => !b.roleRemoved).length;
        const totalHistorical = currentBoosters.length;
        const totalBoosts = currentBoosters.reduce((sum, b) => sum + (b.boostCountTotal || 0), 0);

        return NextResponse.json({
            boosters: currentBoosters,
            stats: {
                activeCount,
                totalHistorical,
                totalBoosts
            }
        });
    } catch (error) {
        console.error("Error fetching boost stats:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
