import { NextRequest, NextResponse } from "next/server";
import { db, guildConfig } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireGuildManageAccess, requireGuildManageRolesAccess } from "@/lib/guild-auth";
import { nullableDiscordIdSchema, optionalEmbedSchema, optionalTextSchema, parseJsonBody } from "@/lib/validation";
import { sanitizeMessageContent, sanitizeEmbedData } from "@/lib/sanitize";

const welcomeConfigSchema = z.object({
    welcomeEnabled: z.boolean().optional(),
    autoRoleId: nullableDiscordIdSchema,
    joinMessageChannelId: nullableDiscordIdSchema,
    joinMessage: optionalTextSchema,
    joinMessageEmbed: optionalEmbedSchema,
    leaveMessageChannelId: nullableDiscordIdSchema,
    leaveMessage: optionalTextSchema,
    leaveMessageEmbed: optionalEmbedSchema,
}).strict();

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const { guildId } = params;

    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const config = await db.query.guildConfig.findFirst({
            where: eq(guildConfig.guildId, guildId),
        });

        if (!config) {
            return NextResponse.json({
                welcomeEnabled: false,
                autoRoleId: null,
                joinMessageChannelId: null,
                joinMessage: null,
                leaveMessageChannelId: null,
                leaveMessage: null,
            });
        }

        return NextResponse.json({
            welcomeEnabled: config.welcomeEnabled,
            autoRoleId: config.autoRoleId,
            joinMessageChannelId: config.joinMessageChannelId,
            joinMessage: config.joinMessage,
            joinMessageEmbed: config.joinMessageEmbed,
            leaveMessageChannelId: config.leaveMessageChannelId,
            leaveMessage: config.leaveMessage,
            leaveMessageEmbed: config.leaveMessageEmbed,
        });
    } catch (error) {
        console.error("Error fetching welcome config:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const { guildId } = params;

    const auth = await requireGuildManageRolesAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsed = await parseJsonBody(req, welcomeConfigSchema);
    if (!parsed.success) return parsed.response;

    try {
        const body = parsed.data;

        // Sanitize message content and embeds
        const sanitizedJoinMessage = body.joinMessage ? sanitizeMessageContent(body.joinMessage) : null;
        const sanitizedLeaveMessage = body.leaveMessage ? sanitizeMessageContent(body.leaveMessage) : null;
        const sanitizedJoinEmbed = body.joinMessageEmbed ? sanitizeEmbedData(body.joinMessageEmbed) : null;
        const sanitizedLeaveEmbed = body.leaveMessageEmbed ? sanitizeEmbedData(body.leaveMessageEmbed) : null;

        await db.insert(guildConfig)
            .values({
                guildId,
                welcomeEnabled: body.welcomeEnabled ?? false,
                autoRoleId: body.autoRoleId || null,
                joinMessageChannelId: body.joinMessageChannelId || null,
                joinMessage: sanitizedJoinMessage,
                joinMessageEmbed: sanitizedJoinEmbed,
                leaveMessageChannelId: body.leaveMessageChannelId || null,
                leaveMessage: sanitizedLeaveMessage,
                leaveMessageEmbed: sanitizedLeaveEmbed,
            })
            .onConflictDoUpdate({
                target: guildConfig.guildId,
                set: {
                    welcomeEnabled: body.welcomeEnabled ?? false,
                    autoRoleId: body.autoRoleId || null,
                    joinMessageChannelId: body.joinMessageChannelId || null,
                    joinMessage: sanitizedJoinMessage,
                    joinMessageEmbed: sanitizedJoinEmbed,
                    leaveMessageChannelId: body.leaveMessageChannelId || null,
                    leaveMessage: sanitizedLeaveMessage,
                    leaveMessageEmbed: sanitizedLeaveEmbed,
                    updatedAt: new Date(),
                },
            });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating welcome config:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
