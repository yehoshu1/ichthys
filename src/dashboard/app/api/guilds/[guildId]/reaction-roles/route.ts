import { NextRequest, NextResponse } from "next/server";
import { db, reactionRole } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireGuildManageAccess, requireGuildManageRolesAccess } from "@/lib/guild-auth";
import { snowflake, parseJsonBody } from "@/lib/validation";
import { sanitizeMessageContent } from "@/lib/sanitize";
import logger from "@/lib/logger";

// Validation schema for reaction role
const reactionRoleSchema = z.object({
    id: z.string().uuid().optional(),
    reactionRoleMessageId: z.string().uuid().optional(),
    messageId: snowflake,
    channelId: snowflake,
    emoji: z.string().min(1).max(100),
    roleId: snowflake,
    type: z.enum(["TOGGLE", "ADD_ONLY", "REMOVE_ONLY", "UNIQUE"]).default("TOGGLE"),
    description: z.string().max(500).nullable().optional(),
    enabled: z.boolean().default(true),
}).strict();

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const roles = await db.select()
            .from(reactionRole)
            .where(eq(reactionRole.guildId, guildId));
        return NextResponse.json(roles);
    } catch (error) {
        logger.error("Error fetching reaction roles", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageRolesAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsed = await parseJsonBody(req, reactionRoleSchema);
    if (!parsed.success) return parsed.response;

    try {
        const body = parsed.data;

        // Sanitize description
        const sanitizedDescription = body.description 
            ? sanitizeMessageContent(body.description) 
            : null;

        // Check for duplicate emoji on the same message
        const existing = await db.query.reactionRole.findFirst({
            where: and(
                eq(reactionRole.messageId, body.messageId),
                eq(reactionRole.emoji, body.emoji),
                eq(reactionRole.guildId, guildId)
            )
        });

        if (existing && (!body.id || existing.id !== body.id)) {
            return NextResponse.json(
                { error: "A reaction role already exists for this emoji on this message" },
                { status: 409 }
            );
        }

        if (body.id) {
            // Update existing
            const updated = await db.update(reactionRole)
                .set({
                    reactionRoleMessageId: body.reactionRoleMessageId || null,
                    messageId: body.messageId,
                    channelId: body.channelId,
                    emoji: body.emoji,
                    roleId: body.roleId,
                    type: body.type,
                    description: sanitizedDescription,
                    enabled: body.enabled ?? true,
                    updatedAt: new Date(),
                })
                .where(and(eq(reactionRole.id, body.id), eq(reactionRole.guildId, guildId)))
                .returning();
            
            if (updated.length === 0) {
                return NextResponse.json({ error: "Reaction role not found" }, { status: 404 });
            }
            return NextResponse.json(updated[0]);
        }

        // Create new
        const inserted = await db.insert(reactionRole).values({
            guildId,
            reactionRoleMessageId: body.reactionRoleMessageId || null,
            messageId: body.messageId,
            channelId: body.channelId,
            emoji: body.emoji,
            roleId: body.roleId,
            type: body.type,
            description: sanitizedDescription,
            enabled: body.enabled ?? true,
        }).returning();

        return NextResponse.json(inserted[0]);
    } catch (error) {
        logger.error("Error saving reaction role", { error: error instanceof Error ? error.message : String(error), guildId });
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

        if (!id) {
            return NextResponse.json({ error: "ID required" }, { status: 400 });
        }

        const deleted = await db.delete(reactionRole)
            .where(and(eq(reactionRole.id, id), eq(reactionRole.guildId, guildId)))
            .returning();

        if (deleted.length === 0) {
            return NextResponse.json({ error: "Reaction role not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("Error deleting reaction role", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
