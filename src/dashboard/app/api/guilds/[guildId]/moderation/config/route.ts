import { NextRequest, NextResponse } from "next/server";
import { db } from "@shared/database/client";
import { moderationSettings } from "@shared/database/schema";
import { eq } from "drizzle-orm";
import { requireGuildManageAccess, requireGuildManageRolesAccess } from "@/lib/guild-auth";
import { nullableDiscordIdSchema, parseJsonBody } from "@/lib/validation";
import { z } from "zod";
import logger from "@/lib/logger";
import { emitDashboardSettingsChanged } from "@/lib/notification-events";

const moderationConfigSchema = z.object({
    autoModEnabled: z.boolean().default(false),
    spamThreshold: z.number().int().min(2).max(20).default(5),
    spamAction: z.enum(["WARN", "MUTE", "KICK"]).default("WARN"),
    spamMuteDuration: z.number().int().min(1).default(10),
    wordFilterEnabled: z.boolean().default(false),
    wordFilterList: z.string().optional(),
    wordFilterAction: z.enum(["DELETE", "WARN", "MUTE", "KICK"]).default("DELETE"),
    inviteFilterEnabled: z.boolean().default(false),
    inviteFilterAction: z.enum(["DELETE", "WARN"]).default("DELETE"),
    logChannelId: nullableDiscordIdSchema,
    muteRoleId: nullableDiscordIdSchema,
}).passthrough();

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    const params = await props.params;
    const { guildId } = params;

    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const config = await db.query.moderationSettings.findFirst({
            where: eq(moderationSettings.guildId, guildId),
        });

        if (!config) {
            // Return default config
            return NextResponse.json({
                autoModEnabled: false,
                spamThreshold: 5,
                spamAction: "WARN",
                spamMuteDuration: 10,
                wordFilterEnabled: false,
                wordFilterList: "",
                wordFilterAction: "DELETE",
                inviteFilterEnabled: false,
                inviteFilterAction: "DELETE",
                logChannelId: null,
                muteRoleId: null,
            });
        }

        return NextResponse.json(config);
    } catch (error) {
        logger.error("Error fetching moderation config", { error, guildId });
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function POST(
    req: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    const params = await props.params;
    const { guildId } = params;

    const auth = await requireGuildManageRolesAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsed = await parseJsonBody(req, moderationConfigSchema);
    if (!parsed.success) return parsed.response;

    try {
        const data = parsed.data;

        await db.insert(moderationSettings)
            .values({
                guildId,
                ...data,
            })
            .onConflictDoUpdate({
                target: moderationSettings.guildId,
                set: {
                    ...data,
                    updatedAt: new Date(),
                },
            });

        logger.info("Updated moderation settings", { guildId, userId: auth.userId });
        await emitDashboardSettingsChanged({
            guildId,
            userId: auth.userId,
            module: "moderation",
            action: "update",
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("Error updating moderation config", { error, guildId });
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
