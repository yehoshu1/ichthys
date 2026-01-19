import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { levelReward } from "@/lib/db";
import { eq, and } from "drizzle-orm";

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
        const rewards = await db.select()
            .from(levelReward)
            .where(eq(levelReward.guildId, guildId))
            .orderBy(levelReward.level);

        return NextResponse.json(rewards);
    } catch (error) {
        console.error("Error fetching level rewards:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const session = await checkAuth(req, guildId);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { roleId, level } = body;

        if (!roleId || level === undefined) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const [newReward] = await db.insert(levelReward)
            .values({
                guildId,
                roleId,
                level: parseInt(level),
            })
            .returning();

        return NextResponse.json(newReward);
    } catch (error) {
        console.error("Error creating level reward:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const session = await checkAuth(req, guildId);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const rewardId = searchParams.get("id");

        if (!rewardId) {
            return NextResponse.json({ error: "Missing reward ID" }, { status: 400 });
        }

        await db.delete(levelReward)
            .where(and(
                eq(levelReward.id, rewardId),
                eq(levelReward.guildId, guildId)
            ));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting level reward:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
