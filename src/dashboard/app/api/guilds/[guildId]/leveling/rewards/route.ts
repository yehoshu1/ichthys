import { NextRequest, NextResponse } from "next/server";
import { db, levelReward } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireGuildManageAccess, requireGuildManageRolesAccess } from "@/lib/guild-auth";
import { discordIdSchema, parseJsonBody } from "@/lib/validation";
import logger from "@/lib/logger";

const createRewardSchema = z.object({
    roleId: discordIdSchema,
    level: z.number().int().min(1).max(1000),
}).strict();

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const rewards = await db.select()
            .from(levelReward)
            .where(eq(levelReward.guildId, guildId))
            .orderBy(levelReward.level);

        return NextResponse.json(rewards);
    } catch (error) {
        logger.error("Error fetching level rewards", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageRolesAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsed = await parseJsonBody(req, createRewardSchema);
    if (!parsed.success) return parsed.response;

    try {
        const body = parsed.data;

        const [newReward] = await db.insert(levelReward)
            .values({
                guildId,
                roleId: body.roleId,
                level: body.level,
            })
            .returning();

        return NextResponse.json(newReward);
    } catch (error) {
        logger.error("Error creating level reward", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageRolesAccess(guildId, req);
    if ("response" in auth) return auth.response;

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
        logger.error("Error deleting level reward", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
