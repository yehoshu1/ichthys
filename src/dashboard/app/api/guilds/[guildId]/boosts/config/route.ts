import { NextRequest, NextResponse } from "next/server";
import { db, guildConfig } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireGuildManageAccess, requireGuildManageRolesAccess } from "@/lib/guild-auth";
import { nullableDiscordIdSchema, optionalEmbedSchema, optionalTextSchema, parseJsonBody } from "@/lib/validation";
import logger from "@/lib/logger";
import { emitDashboardSettingsChanged } from "@/lib/notification-events";

const boostsConfigSchema = z.object({
    boostEnabled: z.boolean().optional(),
    boostAnnouncementChannelId: nullableDiscordIdSchema,
    boostRoleId: nullableDiscordIdSchema,
    boostRoleName: optionalTextSchema,
    boostRoleColorPrimary: optionalTextSchema,
    boostRoleColorSecondary: optionalTextSchema,
    boostClaimRequired: z.boolean().optional(),
    boostWelcomeMessage: optionalTextSchema,
    boostWelcomeMessageEmbed: optionalEmbedSchema,
    boostReBoostMessage: optionalTextSchema,
    boostReBoostMessageEmbed: optionalEmbedSchema,
    boostRoleRemovalDays: z.number().int().min(0).max(365).optional(),
    boostRoleRemovalDmEnabled: z.boolean().optional(),
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
                boostEnabled: false,
                boostAnnouncementChannelId: null,
                boostRoleId: null,
                boostRoleName: null,
                boostRoleColorPrimary: null,
                boostRoleColorSecondary: null,
                boostClaimRequired: true,
                boostWelcomeMessage: "Thank you {user} for boosting {server}! 🚀",
                boostReBoostMessage: "Thank you {user} for renewing your boost for {server}! 🚀",
                boostRoleRemovalDays: 30,
                boostRoleRemovalDmEnabled: true,
            });
        }

        return NextResponse.json(config);
    } catch (error) {
        logger.error("Error fetching boost config", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageRolesAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsed = await parseJsonBody(req, boostsConfigSchema);
    if (!parsed.success) return parsed.response;

    try {
        const body = parsed.data;

        await db.insert(guildConfig).values({
            guildId,
            boostEnabled: body.boostEnabled ?? false,
            boostAnnouncementChannelId: body.boostAnnouncementChannelId || null,
            boostRoleId: body.boostRoleId || null,
            boostRoleName: body.boostRoleName || null,
            boostRoleColorPrimary: body.boostRoleColorPrimary || null,
            boostRoleColorSecondary: body.boostRoleColorSecondary || null,
            boostClaimRequired: body.boostClaimRequired ?? true,
            boostWelcomeMessage: body.boostWelcomeMessage || null,
            boostWelcomeMessageEmbed: body.boostWelcomeMessageEmbed || null,
            boostReBoostMessage: body.boostReBoostMessage || null,
            boostReBoostMessageEmbed: body.boostReBoostMessageEmbed || null,
            boostRoleRemovalDays: body.boostRoleRemovalDays ?? 30,
            boostRoleRemovalDmEnabled: body.boostRoleRemovalDmEnabled ?? true,
        }).onConflictDoUpdate({
            target: guildConfig.guildId,
            set: {
                boostEnabled: body.boostEnabled ?? false,
                boostAnnouncementChannelId: body.boostAnnouncementChannelId || null,
                boostRoleId: body.boostRoleId || null,
                boostRoleName: body.boostRoleName || null,
                boostRoleColorPrimary: body.boostRoleColorPrimary || null,
                boostRoleColorSecondary: body.boostRoleColorSecondary || null,
                boostClaimRequired: body.boostClaimRequired ?? true,
                boostWelcomeMessage: body.boostWelcomeMessage || null,
                boostWelcomeMessageEmbed: body.boostWelcomeMessageEmbed || null,
                boostReBoostMessage: body.boostReBoostMessage || null,
                boostReBoostMessageEmbed: body.boostReBoostMessageEmbed || null,
                boostRoleRemovalDays: body.boostRoleRemovalDays ?? 30,
                boostRoleRemovalDmEnabled: body.boostRoleRemovalDmEnabled ?? true,
                updatedAt: new Date(),
            },
        });

        await emitDashboardSettingsChanged({
            guildId,
            userId: auth.userId,
            module: "boosts",
            action: "update",
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("Error updating boost config", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
