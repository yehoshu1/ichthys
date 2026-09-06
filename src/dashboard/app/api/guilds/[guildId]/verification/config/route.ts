import { NextRequest, NextResponse } from "next/server";
import { db, guildConfig } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireGuildManageAccess, requireGuildManageRolesAccess } from "@/lib/guild-auth";
import { nullableDiscordIdSchema, optionalTextSchema, optionalEmbedSchema, parseJsonBody } from "@/lib/validation";
import logger from "@/lib/logger";
import { emitDashboardSettingsChanged } from "@/lib/notification-events";

const verificationConfigSchema = z.object({
    verificationEnabled: z.boolean().optional(),
    unverifiedRoleId: nullableDiscordIdSchema,
    verificationRoleId: nullableDiscordIdSchema,
    verificationGraceDays: z.number().int().min(1).max(365).optional(),
    verificationKickDmEnabled: z.boolean().optional(),
    verificationMessage: optionalTextSchema,
    verificationMessageEmbed: optionalEmbedSchema,
    verificationMessageChannelId: nullableDiscordIdSchema,
    verificationWelcomeMessage: optionalTextSchema,
}).passthrough();

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const config = await db.query.guildConfig.findFirst({
            where: eq(guildConfig.guildId, guildId),
        });

        if (!config) {
            return NextResponse.json({
                verificationEnabled: false,
                unverifiedRoleId: null,
                verificationRoleId: null,
                verificationGraceDays: 30,
                verificationKickDmEnabled: true,
                verificationMessage: null,
                verificationMessageChannelId: null,
                verificationWelcomeMessage: null,
            });
        }

        return NextResponse.json(config);
    } catch (error) {
        logger.error("Error fetching verification config", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageRolesAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsed = await parseJsonBody(req, verificationConfigSchema);
    if (!parsed.success) return parsed.response;

    try {
        const body = parsed.data;

        await db.insert(guildConfig).values({
            guildId,
            verificationEnabled: body.verificationEnabled ?? false,
            unverifiedRoleId: body.unverifiedRoleId || null,
            verificationRoleId: body.verificationRoleId || null,
            verificationGraceDays: body.verificationGraceDays ?? 30,
            verificationKickDmEnabled: body.verificationKickDmEnabled ?? true,
                verificationMessage: body.verificationMessage || null,
                verificationMessageEmbed: body.verificationMessageEmbed || null,
                verificationMessageChannelId: body.verificationMessageChannelId || null,
                verificationWelcomeMessage: body.verificationWelcomeMessage || null,
        }).onConflictDoUpdate({
            target: guildConfig.guildId,
            set: {
                verificationEnabled: body.verificationEnabled ?? false,
                unverifiedRoleId: body.unverifiedRoleId || null,
                verificationRoleId: body.verificationRoleId || null,
                verificationGraceDays: body.verificationGraceDays ?? 30,
                verificationKickDmEnabled: body.verificationKickDmEnabled ?? true,
                    verificationMessage: body.verificationMessage || null,
                    verificationMessageEmbed: body.verificationMessageEmbed || null,
                    verificationMessageChannelId: body.verificationMessageChannelId || null,
                    verificationWelcomeMessage: body.verificationWelcomeMessage || null,
                lastMemberSync: null,
                updatedAt: new Date(),
            },
        });

        await emitDashboardSettingsChanged({
            guildId,
            userId: auth.userId,
            module: "verification",
            action: "update",
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("Error updating verification config", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
