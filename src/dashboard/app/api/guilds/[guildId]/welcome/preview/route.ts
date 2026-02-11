import { NextRequest, NextResponse } from "next/server";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import logger from "@/lib/logger";
import { generateWelcomeImage, processWelcomeTemplate } from "../../../../../../../bot/services/welcomeImageGenerator";

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
        const config = body.config || body;

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
        const { template, variables } = await req.json();

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
