import { NextRequest, NextResponse } from "next/server";
import { db, messageTemplate } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import { optionalEmbedSchema, optionalTextSchema, parseJsonBody } from "@/lib/validation";
import logger from "@/lib/logger";

const createTemplateSchema = z.object({
    name: z.string().trim().min(1).max(100),
    content: z.string().trim().min(1).max(2000),
    embedEnabled: z.boolean().optional(),
    embedTitle: optionalTextSchema,
    embedDescription: optionalTextSchema,
    embedColor: optionalTextSchema,
    embedThumbnail: z.boolean().optional(),
    embedData: optionalEmbedSchema,
}).strict();

const updateTemplateSchema = createTemplateSchema.extend({
    id: z.string().trim().min(1),
}).strict();

function getIdParam(req: NextRequest): string | null {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    return id && id.trim().length > 0 ? id.trim() : null;
}

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const templates = await db.select()
            .from(messageTemplate)
            .where(eq(messageTemplate.guildId, guildId));
        return NextResponse.json(templates);
    } catch (error) {
        logger.error("Error fetching templates", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsed = await parseJsonBody(req, createTemplateSchema);
    if (!parsed.success) return parsed.response;

    try {
        const body = parsed.data;

        const [newTemplate] = await db.insert(messageTemplate).values({
            guildId,
            name: body.name,
            content: body.content,
            embedEnabled: body.embedEnabled || false,
            embedTitle: body.embedTitle || null,
            embedDescription: body.embedDescription || null,
            embedColor: body.embedColor || null,
            embedThumbnail: body.embedThumbnail || false,
            embedData: body.embedData || null,
        }).returning();

        return NextResponse.json(newTemplate);
    } catch (error) {
        logger.error("Error creating template", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsed = await parseJsonBody(req, updateTemplateSchema);
    if (!parsed.success) return parsed.response;

    try {
        const body = parsed.data;

        const [updated] = await db.update(messageTemplate)
            .set({
                name: body.name,
                content: body.content,
                embedEnabled: body.embedEnabled || false,
                embedTitle: body.embedTitle || null,
                embedDescription: body.embedDescription || null,
                embedColor: body.embedColor || null,
                embedThumbnail: body.embedThumbnail || false,
                embedData: body.embedData || null,
                updatedAt: new Date(),
            })
            .where(and(eq(messageTemplate.id, body.id), eq(messageTemplate.guildId, guildId)))
            .returning();

        return NextResponse.json(updated);
    } catch (error) {
        logger.error("Error updating template", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const id = getIdParam(req);

        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        await db.delete(messageTemplate)
            .where(and(eq(messageTemplate.id, id), eq(messageTemplate.guildId, guildId)));

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("Error deleting template", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
