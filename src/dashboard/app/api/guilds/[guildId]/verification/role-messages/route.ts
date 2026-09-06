import { NextRequest, NextResponse } from "next/server";
import { db, verificationRoleMessage } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireGuildManageAccess, requireGuildManageRolesAccess } from "@/lib/guild-auth";
import { discordIdSchema, optionalEmbedSchema, nullableDiscordIdSchema, optionalTextSchema, parseJsonBody } from "@/lib/validation";
import logger from "@/lib/logger";

const createRoleMessageSchema = z.object({
    roleId: discordIdSchema,
    // message is optional: admins may choose to only set a welcome message or embed
    message: optionalTextSchema,
    messageEmbed: optionalEmbedSchema,
    notifyChannelId: nullableDiscordIdSchema,
    welcomeMessage: optionalTextSchema,
    enabled: z.boolean().optional(),
}).strict();

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const rules = await db.query.verificationRoleMessage.findMany({
            where: eq(verificationRoleMessage.guildId, guildId),
        });

        return NextResponse.json(rules);
    } catch (error) {
        logger.error("Error fetching role messages", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageRolesAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsed = await parseJsonBody(req, createRoleMessageSchema);
    if (!parsed.success) return parsed.response;

    try {
        const body = parsed.data;
        const [newRule] = await db.insert(verificationRoleMessage).values({
            guildId,
            roleId: body.roleId,
            notifyChannelId: body.notifyChannelId || null,
            message: body.message,
            messageEmbed: body.messageEmbed ? JSON.parse(JSON.stringify(body.messageEmbed)) : null,
            welcomeMessage: body.welcomeMessage || null,
            enabled: body.enabled ?? true,
        }).returning();

        return NextResponse.json(newRule);
    } catch (error) {
        logger.error("Error creating role message", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
