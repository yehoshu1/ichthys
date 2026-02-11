import { NextRequest, NextResponse } from "next/server";
import { db } from "@shared/database/client";
import { welcomeConfig } from "@shared/database/schema";
import { eq } from "drizzle-orm";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import logger from "@/lib/logger";

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
                    imageEnabled: false,
                    imageSendMode: 'WITH_TEXT',
                    imageChannelId: null,
                    // ProBot-style canvas size (2:1 aspect ratio)
                    canvasWidth: 400,
                    canvasHeight: 200,
                    backgroundType: 'COLOR',
                    backgroundValue: 'transparent',
                    // Avatar - centered at top (ProBot style)
                    avatarShape: 'CIRCLE',
                    avatarX: 155,
                    avatarY: 10,
                    avatarSize: 90,
                    avatarBorderColor: '#ffffff',
                    avatarBorderWidth: 0,
                    // Username - centered below avatar
                    usernameX: 200,
                    usernameY: 115,
                    usernameFont: 'Arial',
                    usernameSize: 18,
                    usernameColor: '#ffffff',
                    usernameAlign: 'center',
                    // Subtitle - centered below username
                    subtitleEnabled: true,
                    subtitleTemplate: 'Welcome to {server}',
                    subtitleX: 200,
                    subtitleY: 140,
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

        logger.info("Saving welcome config", { guildId, hasConfig: !!configData, enabled: configData?.enabled, targetType: configData?.targetType, hasChannelId: !!configData?.channelId });

        // Validate required fields - only if enabled and target is CHANNEL
        if (configData.enabled === true && configData.targetType === 'CHANNEL' && !configData.channelId) {
            logger.warn("Validation failed: Channel ID required", { guildId });
            return NextResponse.json(
                { error: "Please select a channel for welcome messages", field: "channelId" },
                { status: 400 }
            );
        }

        // Remove UI-only fields that don't exist in database
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { avatarWidth, avatarHeight, usernameWidth, id, ...dbData } = configData;
        
        // Ensure guildId is set
        dbData.guildId = guildId;

        const existing = await db.query.welcomeConfig.findFirst({
            where: eq(welcomeConfig.guildId, guildId)
        });

        let result;
        if (existing) {
            // Update
            [result] = await db
                .update(welcomeConfig)
                .set({
                    ...dbData,
                    updatedAt: new Date()
                })
                .where(eq(welcomeConfig.id, existing.id))
                .returning();
        } else {
            // Create
            [result] = await db
                .insert(welcomeConfig)
                .values({
                    guildId,
                    ...dbData,
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
