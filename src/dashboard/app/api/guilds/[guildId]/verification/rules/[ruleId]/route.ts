import { NextRequest, NextResponse } from "next/server";
import { db, verificationMessageRule } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireGuildManageRolesAccess } from "@/lib/guild-auth";
import { discordIdSchema, optionalEmbedSchema, parseJsonBody } from "@/lib/validation";
import logger from "@/lib/logger";

const updateRuleSchema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    roleId: discordIdSchema.optional(),
    notifyChannelId: discordIdSchema.optional(),
    message: z.string().trim().min(1).max(2000).optional(),
    messageEmbed: optionalEmbedSchema,
    welcomeMessage: z.string().trim().max(2000).optional().nullable(),
    enabled: z.boolean().optional(),
}).strict();

export async function DELETE(req: NextRequest, props: { params: Promise<{ guildId: string, ruleId: string }> }) {
    const params = await props.params;
    const { guildId, ruleId } = params;

    const auth = await requireGuildManageRolesAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        await db.delete(verificationMessageRule)
            .where(and(
                eq(verificationMessageRule.id, ruleId),
                eq(verificationMessageRule.guildId, guildId)
            ));

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("Error deleting verification rule", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ guildId: string, ruleId: string }> }) {
    const params = await props.params;
    const { guildId, ruleId } = params;

    const auth = await requireGuildManageRolesAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsed = await parseJsonBody(req, updateRuleSchema);
    if (!parsed.success) return parsed.response;

    try {
        const body = parsed.data;
        const updates: Record<string, unknown> = {
            updatedAt: new Date(),
        };

        if (body.name !== undefined) updates.name = body.name;
        if (body.roleId !== undefined) updates.roleId = body.roleId;
        if (body.notifyChannelId !== undefined) updates.notifyChannelId = body.notifyChannelId;
        if (body.message !== undefined) updates.message = body.message;
        if (body.welcomeMessage !== undefined) updates.welcomeMessage = body.welcomeMessage;
        if (body.messageEmbed !== undefined) {
            // Clean undefined values from embed object for JSON serialization
            updates.messageEmbed = body.messageEmbed ? JSON.parse(JSON.stringify(body.messageEmbed)) : null;
        }
        if (body.enabled !== undefined) updates.enabled = body.enabled;

        const [updated] = await db.update(verificationMessageRule)
            .set(updates)
            .where(and(
                eq(verificationMessageRule.id, ruleId),
                eq(verificationMessageRule.guildId, guildId)
            ))
            .returning();

        return NextResponse.json(updated);
    } catch (error) {
        logger.error("Error updating verification rule", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
