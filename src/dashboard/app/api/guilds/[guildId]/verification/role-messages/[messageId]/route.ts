import { NextRequest, NextResponse } from "next/server";
import { db, verificationRoleMessage } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireGuildManageRolesAccess } from "@/lib/guild-auth";
import { discordIdSchema, optionalEmbedSchema, parseJsonBody } from "@/lib/validation";
import logger from "@/lib/logger";

const updateRoleMessageSchema = z.object({
    roleId: discordIdSchema.optional(),
    message: z.string().trim().min(1).max(2000).optional(),
    messageEmbed: optionalEmbedSchema,
    enabled: z.boolean().optional(),
}).strict();

export async function DELETE(req: NextRequest, props: { params: Promise<{ guildId: string, messageId: string }> }) {
    const params = await props.params;
    const { guildId, messageId } = params;

    const auth = await requireGuildManageRolesAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        await db.delete(verificationRoleMessage)
            .where(and(
                eq(verificationRoleMessage.id, messageId),
                eq(verificationRoleMessage.guildId, guildId)
            ));

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("Error deleting role message", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ guildId: string, messageId: string }> }) {
    const params = await props.params;
    const { guildId, messageId } = params;

    const auth = await requireGuildManageRolesAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsed = await parseJsonBody(req, updateRoleMessageSchema);
    if (!parsed.success) return parsed.response;

    try {
        const body = parsed.data;
        const updates: Record<string, unknown> = { updatedAt: new Date() };

        if (body.roleId !== undefined) updates.roleId = body.roleId;
        if (body.message !== undefined) updates.message = body.message;
        if (body.messageEmbed !== undefined) updates.messageEmbed = body.messageEmbed;
        if (body.enabled !== undefined) updates.enabled = body.enabled;

        const [updated] = await db.update(verificationRoleMessage)
            .set(updates)
            .where(and(
                eq(verificationRoleMessage.id, messageId),
                eq(verificationRoleMessage.guildId, guildId)
            ))
            .returning();

        return NextResponse.json(updated);
    } catch (error) {
        logger.error("Error updating role message", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
