import { NextRequest, NextResponse } from "next/server";
import { db, guildConfig } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import { nullableDiscordIdSchema, optionalEmbedSchema, optionalTextSchema, parseJsonBody } from "@/lib/validation";
import logger from "@/lib/logger";
import { emitDashboardSettingsChanged } from "@/lib/notification-events";

const levelingConfigSchema = z.object({
    levelingEnabled: z.boolean().optional(),
    textXpMin: z.number().int().min(1).max(1000).optional(),
    textXpMax: z.number().int().min(1).max(1000).optional(),
    textXpCooldown: z.number().int().min(1).max(3600).optional(),
    voiceXpPerMinute: z.number().int().min(0).max(1000).optional(),
    levelUpNotifEnabled: z.boolean().optional(),
    levelUpChannelId: nullableDiscordIdSchema,
    levelUpMessage: optionalTextSchema,
    levelUpMessageEmbed: optionalEmbedSchema,
}).passthrough(); // Allow extra fields (frontend sends entire config)

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
                levelingEnabled: false,
                textXpMin: 15,
                textXpMax: 25,
                textXpCooldown: 60,
                voiceXpPerMinute: 10,
                levelUpNotifEnabled: true,
                levelUpChannelId: null,
                levelUpMessage: null,
            });
        }

        return NextResponse.json(config);
    } catch (error) {
        logger.error("Error fetching leveling config", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsed = await parseJsonBody(req, levelingConfigSchema);
    if (!parsed.success) return parsed.response;

    try {
        const body = parsed.data;
        const safeTextXpMin = body.textXpMin ?? 15;
        const safeTextXpMax = body.textXpMax ?? 25;
        const safeTextXpCooldown = body.textXpCooldown ?? 60;
        const safeVoiceXpPerMinute = body.voiceXpPerMinute ?? 10;

        if (safeTextXpMin > safeTextXpMax) {
            return NextResponse.json({ error: "textXpMin cannot be greater than textXpMax" }, { status: 400 });
        }

        await db.insert(guildConfig).values({
            guildId,
            levelingEnabled: body.levelingEnabled ?? false,
            textXpMin: safeTextXpMin,
            textXpMax: safeTextXpMax,
            textXpCooldown: safeTextXpCooldown,
            voiceXpPerMinute: safeVoiceXpPerMinute,
            levelUpNotifEnabled: body.levelUpNotifEnabled ?? true,
            levelUpChannelId: body.levelUpChannelId || null,
            levelUpMessage: body.levelUpMessage || null,
            levelUpMessageEmbed: body.levelUpMessageEmbed || null,
        }).onConflictDoUpdate({
            target: guildConfig.guildId,
            set: {
                levelingEnabled: body.levelingEnabled ?? false,
                textXpMin: safeTextXpMin,
                textXpMax: safeTextXpMax,
                textXpCooldown: safeTextXpCooldown,
                voiceXpPerMinute: safeVoiceXpPerMinute,
                levelUpNotifEnabled: body.levelUpNotifEnabled ?? true,
                levelUpChannelId: body.levelUpChannelId || null,
                levelUpMessage: body.levelUpMessage || null,
                levelUpMessageEmbed: body.levelUpMessageEmbed || null,
                updatedAt: new Date(),
            },
        });

        await emitDashboardSettingsChanged({
            guildId,
            userId: auth.userId,
            module: "leveling",
            action: "update",
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("Error updating leveling config", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
