import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { roleAction } from "@/lib/db";
import { eq, and } from "drizzle-orm";

async function checkAuth(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;
    return session;
}

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const session = await checkAuth(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const actions = await db.select()
            .from(roleAction)
            .where(eq(roleAction.guildId, guildId));
        return NextResponse.json(actions);
    } catch (error) {
        console.error("Error fetching role actions:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const session = await checkAuth(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { id, roleId, triggerType, actionType, actionGroup, actionDelay, dmMessage, dmMessageEmbed, channelId, kickReason, logChannelId, enabled } = body;

        if (!roleId || !actionType) {
            return NextResponse.json({ error: "Role and Action Type are required" }, { status: 400 });
        }

        if (id) {
            // Update
            const updated = await db.update(roleAction)
                .set({
                    roleId,
                    triggerType: triggerType || 'ADD',
                    actionType,
                    actionGroup: actionGroup || null,
                    actionDelay: actionDelay || 0,
                    dmMessage,
                    dmMessageEmbed, // <--- Added
                    channelId,
                    kickReason,
                    logChannelId,
                    enabled: enabled ?? true,
                    updatedAt: new Date()
                })
                .where(and(eq(roleAction.id, id), eq(roleAction.guildId, guildId)))
                .returning();
            return NextResponse.json(updated[0]);
        } else {
            // Create
            const inserted = await db.insert(roleAction).values({
                guildId,
                roleId,
                triggerType: triggerType || 'ADD',
                actionType,
                actionGroup: actionGroup || null,
                actionDelay: actionDelay || 0,
                dmMessage,
                dmMessageEmbed, // <--- Added
                channelId,
                kickReason,
                logChannelId,
                enabled: enabled ?? true,
            }).returning();
            return NextResponse.json(inserted[0]);
        }
    } catch (error) {
        console.error("Error saving role action:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const session = await checkAuth(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        await db.delete(roleAction)
            .where(and(eq(roleAction.id, id), eq(roleAction.guildId, guildId)));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting role action:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
