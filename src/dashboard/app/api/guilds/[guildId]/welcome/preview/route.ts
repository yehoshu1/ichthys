import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import logger from "@/lib/logger";
import { generateWelcomeImage, processWelcomeTemplate } from "@shared/services/welcome-image-generator";

const welcomeConfigSchema = z.object({
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
}).partial();

const previewSchema = z.object({
    config: welcomeConfigSchema.optional(),
});

const previewMessageSchema = z.object({
    template: z.string().min(1).max(2000),
    variables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
}).strict();

/**
 * POST /api/guilds/[guildId]/welcome/preview
 * Generate a preview welcome image
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
        const parsed = previewSchema.safeParse(body.config ? body : { config: body });
        if (!parsed.success) {
            console.error("ZOD VALIDATION FAILED:", JSON.stringify(parsed.error.issues, null, 2));
            return NextResponse.json(
                { error: "Invalid request body", details: parsed.error.issues },
                { status: 400 }
            );
        }
        const config = parsed.data.config || body.config || body;

        // Generate preview image with sample data
        const imageResult = await generateWelcomeImage({
            username: 'Preview User',
            discriminator: '1234',
            avatarUrl: `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 5)}.png`,
            serverName: 'Your Awesome Server',
            memberCount: 1337,
            config
        });

        if (!imageResult) {
            return NextResponse.json(
                { error: "Failed to generate preview image" },
                { status: 500 }
            );
        }

        // Return image as base64 for preview
        const base64 = imageResult.buffer.toString('base64');

        return NextResponse.json({
            image: `data:image/png;base64,${base64}`,
            width: imageResult.width,
            height: imageResult.height
        });
    } catch (error) {
        logger.error("Error generating welcome preview", { error, guildId });
        return NextResponse.json(
            { error: "Failed to generate preview" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/guilds/[guildId]/welcome/preview/message
 * Preview the welcome message text
 */
export async function PUT(
    req: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    const params = await props.params;
    const { guildId } = params;

    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const body = await req.json();
        const parsed = previewMessageSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid request body", details: parsed.error.issues },
                { status: 400 }
            );
        }
        const { template, variables } = parsed.data;

        const vars = {
            user: '<@123456789>',
            username: 'PreviewUser',
            tag: 'PreviewUser#1234',
            server: 'Your Awesome Server',
            memberCount: 1337,
            accountCreated: '01/01/2020',
            joinDate: new Date().toLocaleDateString(),
            ...variables
        };

        const processed = processWelcomeTemplate(template, vars);

        return NextResponse.json({ message: processed });
    } catch (error) {
        logger.error("Error previewing welcome message", { error, guildId });
        return NextResponse.json(
            { error: "Failed to process template" },
            { status: 500 }
        );
    }
}
