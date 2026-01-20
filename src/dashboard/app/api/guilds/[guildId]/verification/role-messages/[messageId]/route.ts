import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { verificationRoleMessage } from "@/lib/db";
import { eq, and } from "drizzle-orm";

async function checkAuth(req: NextRequest, guildId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;
    return session;
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ guildId: string, messageId: string }> }) {
    const params = await props.params;
    const { guildId, messageId } = params;

    const session = await checkAuth(req, guildId);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        await db.delete(verificationRoleMessage)
            .where(and(
                eq(verificationRoleMessage.id, messageId),
                eq(verificationRoleMessage.guildId, guildId)
            ));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting role message:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ guildId: string, messageId: string }> }) {
    const params = await props.params;
    const { guildId, messageId } = params;

    const session = await checkAuth(req, guildId);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { roleId, message, messageEmbed, enabled } = body;
        const updates: Record<string, unknown> = { updatedAt: new Date() };

        if (roleId !== undefined) updates.roleId = roleId;
        if (message !== undefined) updates.message = message;
        if (messageEmbed !== undefined) updates.messageEmbed = messageEmbed;
        if (enabled !== undefined) updates.enabled = enabled;

        const [updated] = await db.update(verificationRoleMessage)
            .set(updates)
            .where(and(
                eq(verificationRoleMessage.id, messageId),
                eq(verificationRoleMessage.guildId, guildId)
            ))
            .returning();

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Error updating role message:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
