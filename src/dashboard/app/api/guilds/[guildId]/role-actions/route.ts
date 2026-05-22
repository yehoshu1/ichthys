import { NextRequest, NextResponse } from "next/server";
import { db, roleAction } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireGuildManageAccess, requireGuildManageRolesAccess } from "@/lib/guild-auth";
import { discordIdSchema, nullableDiscordIdSchema, optionalEmbedSchema, optionalTextSchema, parseJsonBody } from "@/lib/validation";
import logger from "@/lib/logger";
import { emitDashboardSettingsChanged } from "@/lib/notification-events";

const roleActionSchema = z.object({
    id: z.string().trim().min(1).optional(),
    roleId: discordIdSchema,
    triggerType: z.enum(["ADD", "REMOVE"]).optional(),
    actionType: z.enum(["DM", "KICK", "LOG", "MSG", "MESSAGE"]),
    actionGroup: z.union([z.string().trim().min(1).max(100), z.null()]).optional(),
    actionDelay: z.number().int().min(0).max(10080).optional(),
    dmMessage: optionalTextSchema,
    dmMessageEmbed: optionalEmbedSchema,
    channelId: nullableDiscordIdSchema,
    kickReason: optionalTextSchema,
    logChannelId: nullableDiscordIdSchema,
    enabled: z.boolean().optional(),
    requiredRoleIds: z.array(z.string().trim().min(1)).optional(),
    requiredRoleLogic: z.enum(["AND", "OR"]).optional(),
});

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const actions = await db.select()
            .from(roleAction)
            .where(eq(roleAction.guildId, guildId));
        return NextResponse.json(actions);
    } catch (error) {
        logger.error("Error fetching role actions", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageRolesAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsed = await parseJsonBody(req, roleActionSchema);
    if (!parsed.success) return parsed.response;

    try {
        const body = parsed.data;

        if (body.id) {
            const updated = await db.update(roleAction)
                .set({
                    roleId: body.roleId,
                    triggerType: body.triggerType || "ADD",
                    actionType: body.actionType,
                    actionGroup: body.actionGroup || null,
                    actionDelay: body.actionDelay || 0,
                    dmMessage: body.dmMessage || null,
                    dmMessageEmbed: body.dmMessageEmbed || null,
                    channelId: body.channelId || null,
                    kickReason: body.kickReason || null,
                    logChannelId: body.logChannelId || null,
                    enabled: body.enabled ?? true,
                    requiredRoleIds: body.requiredRoleIds ?? [],
                    requiredRoleLogic: body.requiredRoleLogic || "AND",
                    updatedAt: new Date(),
                })
                .where(and(eq(roleAction.id, body.id), eq(roleAction.guildId, guildId)))
                .returning();
            await emitDashboardSettingsChanged({
                guildId,
                userId: auth.userId,
                module: "role-actions",
                action: "update",
                metadata: { roleActionId: body.id },
            });
            return NextResponse.json(updated[0]);
        }

        const inserted = await db.insert(roleAction).values({
            guildId,
            roleId: body.roleId,
            triggerType: body.triggerType || "ADD",
            actionType: body.actionType,
            actionGroup: body.actionGroup || null,
            actionDelay: body.actionDelay || 0,
            dmMessage: body.dmMessage || null,
            dmMessageEmbed: body.dmMessageEmbed || null,
            channelId: body.channelId || null,
            kickReason: body.kickReason || null,
            logChannelId: body.logChannelId || null,
            enabled: body.enabled ?? true,
            requiredRoleIds: body.requiredRoleIds ?? [],
            requiredRoleLogic: body.requiredRoleLogic || "AND",
        }).returning();
        await emitDashboardSettingsChanged({
            guildId,
            userId: auth.userId,
            module: "role-actions",
            action: "create",
            metadata: { roleActionId: inserted[0]?.id ?? null },
        });
        return NextResponse.json(inserted[0]);
    } catch (error) {
        logger.error("Error saving role action", { error: error instanceof Error ? error.message : String(error), guildId });
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
        const id = searchParams.get("id");

        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        await db.delete(roleAction)
            .where(and(eq(roleAction.id, id), eq(roleAction.guildId, guildId)));

        await emitDashboardSettingsChanged({
            guildId,
            userId: auth.userId,
            module: "role-actions",
            action: "delete",
            metadata: { roleActionId: id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("Error deleting role action", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
