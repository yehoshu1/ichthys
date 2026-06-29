import { NextRequest, NextResponse } from "next/server";
import { db } from "@shared/database/client";
import { welcomeConfig } from "@shared/database/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import logger from "@/lib/logger";

const welcomeConfigSchema = z.object({
    id: z.string().optional(),
    enabled: z.boolean(),
    targetType: z.enum(["CHANNEL", "DM"]),
    channelId: z.string().nullable().optional(),
    messageTemplate: z.string().max(2000).nullable().optional(),
    embedEnabled: z.boolean(),
    embedConfig: z.record(z.string(), z.unknown()).nullable().optional(),
    welcomeBotsEnabled: z.boolean().optional(),
    goodbyeEnabled: z.boolean().optional(),
    goodbyeChannelId: z.string().nullable().optional(),
    goodbyeMessageTemplate: z.string().max(2000).nullable().optional(),
    goodbyeEmbedEnabled: z.boolean().optional(),
    goodbyeEmbedConfig: z.record(z.string(), z.unknown()).nullable().optional(),
    goodbyeBotsEnabled: z.boolean().optional(),
    goodbyeImageEnabled: z.boolean().optional(),
    privateEnabled: z.boolean().optional(),
    privateMessageTemplate: z.string().max(2000).nullable().optional(),
    privateEmbedEnabled: z.boolean().optional(),
    privateEmbedConfig: z.record(z.string(), z.unknown()).nullable().optional(),
    privateImageEnabled: z.boolean().optional(),
    imageEnabled: z.boolean(),
    imageSendMode: z.enum(["WITH_TEXT", "BEFORE_TEXT", "TO_CHANNEL", "IMAGE_ONLY"]),
    imageChannelId: z.string().nullable().optional(),
    canvasWidth: z.number().int().min(100).max(2000),
    canvasHeight: z.number().int().min(100).max(2000),
    backgroundType: z.enum(["COLOR", "GRADIENT", "IMAGE"]),
    backgroundValue: z.string().max(2048),
    overlayOpacity: z.number().int().min(0).max(100).optional(),
    avatarShape: z.enum(["CIRCLE", "SQUARE", "ROUNDED"]),
    avatarX: z.number().int().min(0).max(4000),
    avatarY: z.number().int().min(0).max(4000),
    avatarSize: z.number().int().min(16).max(1024),
    avatarBorderColor: z.string().max(32).nullable().optional(),
    avatarBorderWidth: z.number().int().min(0).max(50),
    usernameX: z.number().int().min(0).max(4000),
    usernameY: z.number().int().min(0).max(4000),
    usernameFont: z.string().max(200),
    usernameSize: z.number().int().min(8).max(200),
    usernameColor: z.string().max(32),
    usernameAlign: z.enum(["left", "center", "right"]),
    subtitleEnabled: z.boolean(),
    subtitleTemplate: z.string().max(2000).nullable().optional(),
    subtitleX: z.number().int().min(0).max(4000),
    subtitleY: z.number().int().min(0).max(4000),
    subtitleFont: z.string().max(200),
    subtitleSize: z.number().int().min(8).max(200),
    subtitleColor: z.string().max(32),
    showServerName: z.boolean(),
    serverNameX: z.number().int().min(0).max(4000),
    serverNameY: z.number().int().min(0).max(4000),
    serverNameFont: z.string().max(200),
    serverNameSize: z.number().int().min(8).max(200),
    serverNameColor: z.string().max(32),
    cooldownEnabled: z.boolean(),
    cooldownSeconds: z.number().int().min(0).max(3600),
    avatarWidth: z.number().int().min(0).max(4000).optional(),
    avatarHeight: z.number().int().min(0).max(4000).optional(),
    usernameWidth: z.number().int().min(0).max(4000).optional(),
}).partial();

/**
 * GET /api/guilds/[guildId]/welcome/config
 * Get welcome configuration for a guild
 */
export async function GET(
    req: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    const params = await props.params;
    const { guildId } = params;

    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        let config = await db.query.welcomeConfig.findFirst({
            where: eq(welcomeConfig.guildId, guildId)
        });

        // Return default config if none exists
        if (!config) {
            return NextResponse.json({
                config: {
                    enabled: false,
                    targetType: 'CHANNEL',
                    channelId: null,
                    messageTemplate: 'Welcome {user} to {server}! You are member #{memberCount}.',
                    embedEnabled: false,
                    embedConfig: null,
                    welcomeBotsEnabled: false,
                    goodbyeEnabled: false,
                    goodbyeChannelId: null,
                    goodbyeMessageTemplate: '{user} has left the server.',
                    goodbyeEmbedEnabled: false,
                    goodbyeEmbedConfig: null,
                    goodbyeBotsEnabled: false,
                    goodbyeImageEnabled: false,
                    privateEnabled: false,
                    privateMessageTemplate: 'Welcome {user} to {server}!',
                    privateEmbedEnabled: false,
                    privateEmbedConfig: null,
                    privateImageEnabled: false,
                    imageEnabled: false,
                    imageSendMode: 'WITH_TEXT',
                    imageChannelId: null,
                    // ProBot-style canvas size (2:1 aspect ratio)
                    canvasWidth: 400,
                    canvasHeight: 200,
                    backgroundType: 'COLOR',
                    backgroundValue: 'transparent',
                    overlayOpacity: 50,
                    // Avatar - centered at top (ProBot style)
                    avatarShape: 'CIRCLE',
                    avatarX: 155,
                    avatarY: 23,
                    avatarSize: 90,
                    avatarBorderColor: '#ffffff',
                    avatarBorderWidth: 0,
                    // Username - centered below avatar
                    usernameX: 200,
                    usernameY: 146,
                    usernameFont: 'Arial',
                    usernameSize: 18,
                    usernameColor: '#ffffff',
                    usernameAlign: 'center',
                    // Subtitle - centered below username
                    subtitleEnabled: true,
                    subtitleTemplate: 'Welcome to {server}',
                    subtitleX: 200,
                    subtitleY: 177,
                    subtitleFont: 'Arial',
                    subtitleSize: 16,
                    subtitleColor: '#ffffff',
                    // Server name (hidden by default)
                    showServerName: false,
                    serverNameX: 200,
                    serverNameY: 30,
                    serverNameFont: 'Arial',
                    serverNameSize: 20,
                    serverNameColor: '#ffffff',
                    cooldownEnabled: false,
                    cooldownSeconds: 5
                }
            });
        }

        return NextResponse.json({ config });
    } catch (error) {
        logger.error("Error fetching welcome config", { error, guildId });
        return NextResponse.json(
            { error: "Failed to fetch welcome configuration" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/guilds/[guildId]/welcome/config
 * Update welcome configuration
 */
export async function POST(
    req: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    const params = await props.params;
    const { guildId } = params;

    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const body = await req.json();
        // Support both { config: {...} } and direct body formats
        const configData = body.config || body;
        const parsed = welcomeConfigSchema.safeParse(configData);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid request body", details: parsed.error.issues },
                { status: 400 }
            );
        }
        const validatedConfig = parsed.data;

        logger.info("Saving welcome config", { guildId, hasConfig: !!validatedConfig, enabled: validatedConfig.enabled, targetType: validatedConfig.targetType, hasChannelId: !!validatedConfig.channelId });

        // Validate required fields - only if enabled and target is CHANNEL
        if (validatedConfig.enabled === true && validatedConfig.targetType === 'CHANNEL' && !validatedConfig.channelId) {
            logger.warn("Validation failed: Channel ID required", { guildId });
            return NextResponse.json(
                { error: "Please select a channel for welcome messages", field: "channelId" },
                { status: 400 }
            );
        }

        // Remove UI-only fields that don't exist in database
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { avatarWidth, avatarHeight, usernameWidth, id, ...dbData } = validatedConfig;
        const dbPayload = { guildId, ...dbData };

        const existing = await db.query.welcomeConfig.findFirst({
            where: eq(welcomeConfig.guildId, guildId)
        });

        let result;
        if (existing) {
            // Update
            [result] = await db
                .update(welcomeConfig)
                .set({
                    ...dbPayload,
                    updatedAt: new Date()
                })
                .where(eq(welcomeConfig.id, existing.id))
                .returning();
        } else {
            // Create
            [result] = await db
                .insert(welcomeConfig)
                .values({
                    ...dbPayload,
                    createdAt: new Date(),
                    updatedAt: new Date()
                })
                .returning();
        }

        logger.info("Welcome config updated", { guildId, userId: auth.userId });

        return NextResponse.json({ config: result });
    } catch (error) {
        logger.error("Error updating welcome config", { error, guildId });
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: "Failed to update welcome configuration", details: errorMessage },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/guilds/[guildId]/welcome/config
 * Reset welcome configuration to defaults
 */
export async function DELETE(
    req: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    const params = await props.params;
    const { guildId } = params;

    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        await db
            .delete(welcomeConfig)
            .where(eq(welcomeConfig.guildId, guildId));

        logger.info("Welcome config reset", { guildId, userId: auth.userId });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("Error resetting welcome config", { error, guildId });
        return NextResponse.json(
            { error: "Failed to reset welcome configuration" },
            { status: 500 }
        );
    }
}
