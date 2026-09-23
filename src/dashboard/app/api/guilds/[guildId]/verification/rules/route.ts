import { NextRequest, NextResponse } from "next/server";
import { db, verificationMessageRule } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireGuildManageAccess, requireGuildManageRolesAccess } from "@/lib/guild-auth";
import { discordIdSchema, optionalEmbedSchema, optionalTextSchema, parseJsonBody } from "@/lib/validation";
import logger from "@/lib/logger";

const createRuleSchema = z.object({
    name: z.string().trim().min(1).max(100),
    roleId: discordIdSchema,
    notifyChannelId: discordIdSchema,
    // Notification message optional — allow only welcome message or embed
    message: optionalTextSchema,
    messageEmbed: optionalEmbedSchema,
    welcomeMessage: optionalTextSchema,
    enabled: z.boolean().optional(),
}).strict();

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const rules = await db.query.verificationMessageRule.findMany({
            where: eq(verificationMessageRule.guildId, guildId),
        });

        return NextResponse.json(rules);
    } catch (error) {
        logger.error("Error fetching verification rules", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageRolesAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsed = await parseJsonBody(req, createRuleSchema);
    if (!parsed.success) return parsed.response;

    try {
        const body = parsed.data;

        const [newRule] = await db.insert(verificationMessageRule).values({
            guildId,
            name: body.name,
            roleId: body.roleId,
            notifyChannelId: body.notifyChannelId,
            message: body.message,
            messageEmbed: body.messageEmbed ? JSON.parse(JSON.stringify(body.messageEmbed)) : null,
            welcomeMessage: body.welcomeMessage || null,
            enabled: body.enabled ?? true,
        }).returning();

        return NextResponse.json(newRule);
    } catch (error) {
        logger.error("Error creating verification rule", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
