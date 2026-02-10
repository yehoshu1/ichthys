import { NextRequest, NextResponse } from "next/server";
import { db, welcomeTrigger, messageTemplate } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireGuildManageAccess, requireGuildManageRolesAccess } from "@/lib/guild-auth";
import { nullableDiscordIdSchema, discordIdSchema, parseJsonBody } from "@/lib/validation";
import logger from "@/lib/logger";

const createTriggerSchema = z.object({
    roleId: discordIdSchema,
    templateId: z.string().trim().min(1),
    channelId: nullableDiscordIdSchema,
    enabled: z.boolean().optional(),
}).strict();

const updateTriggerSchema = createTriggerSchema.extend({
    id: z.string().trim().min(1),
}).strict();

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const triggers = await db.select({
            id: welcomeTrigger.id,
            roleId: welcomeTrigger.roleId,
            channelId: welcomeTrigger.channelId,
            templateId: welcomeTrigger.templateId,
            enabled: welcomeTrigger.enabled,
            templateName: messageTemplate.name,
        })
            .from(welcomeTrigger)
            .innerJoin(messageTemplate, eq(welcomeTrigger.templateId, messageTemplate.id))
            .where(eq(welcomeTrigger.guildId, guildId));

        return NextResponse.json(triggers);
    } catch (error) {
        logger.error("Error fetching triggers", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageRolesAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsed = await parseJsonBody(req, createTriggerSchema);
    if (!parsed.success) return parsed.response;

    try {
        const body = parsed.data;
        const [newTrigger] = await db.insert(welcomeTrigger).values({
            guildId,
            roleId: body.roleId,
            templateId: body.templateId,
            channelId: body.channelId || null,
            enabled: body.enabled !== undefined ? body.enabled : true,
        }).returning();

        return NextResponse.json(newTrigger);
    } catch (error) {
        logger.error("Error creating trigger", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageRolesAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsed = await parseJsonBody(req, updateTriggerSchema);
    if (!parsed.success) return parsed.response;

    try {
        const body = parsed.data;

        const [updated] = await db.update(welcomeTrigger)
            .set({
                roleId: body.roleId,
                templateId: body.templateId,
                channelId: body.channelId || null,
                enabled: body.enabled ?? true,
                updatedAt: new Date(),
            })
            .where(and(eq(welcomeTrigger.id, body.id), eq(welcomeTrigger.guildId, guildId)))
            .returning();

        return NextResponse.json(updated);
    } catch (error) {
        logger.error("Error updating trigger", { error: error instanceof Error ? error.message : String(error), guildId });
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

        await db.delete(welcomeTrigger)
            .where(and(eq(welcomeTrigger.id, id), eq(welcomeTrigger.guildId, guildId)));

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("Error deleting trigger", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
