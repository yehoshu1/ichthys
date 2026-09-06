import { NextRequest, NextResponse } from "next/server";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import logger from "@/lib/logger";

const CACHE_TTL = 300 * 1000; // 5 minutes
const cache = new Map<string, { data: { id: string; name: string; type: number }[]; timestamp: number }>();

interface DiscordApiChannel {
    id: string;
    name: string;
    type: number;
    position?: number;
}

async function fetchChannelsWithBotToken(guildId: string, botToken: string): Promise<DiscordApiChannel[] | null> {
    try {
        const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
            headers: { Authorization: `Bot ${botToken}` },
        });

        if (!response.ok) {
            logger.warn("Bot token channels fetch failed", {
                status: response.status,
                guildId
            });
            return null;
        }

        return await response.json() as DiscordApiChannel[];
    } catch (error) {
        logger.error("Bot token fetch failed", { error, guildId });
        return null;
    }
}

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const { guildId } = params;

    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    // Check cache
    const cached = cache.get(guildId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json({ channels: cached.data });
    }

    try {
        const botToken = process.env.DISCORD_TOKEN;
        let channels: DiscordApiChannel[] | null = null;

        // Try bot token first
        if (botToken) {
            channels = await fetchChannelsWithBotToken(guildId, botToken);
        }

        if (!channels) {
            if (cached) {
                logger.warn("Serving stale channels cache", { guildId });
                return NextResponse.json({ channels: cached.data });
            }

            return NextResponse.json({ 
                error: "Failed to fetch channels",
                channels: []
            }, { status: 404 });
        }

        // Filter and format channels (text and announcement channels only)
        const allowedChannelTypes = [0, 5]; // GUILD_TEXT, GUILD_ANNOUNCEMENT
        const formattedChannels = channels
            .filter((channel) => allowedChannelTypes.includes(channel.type))
            .sort((a, b) => (a.position || 0) - (b.position || 0))
            .map((channel) => ({
                id: channel.id,
                name: channel.name,
                type: channel.type
            }));

        // Update cache
        cache.set(guildId, { data: formattedChannels, timestamp: Date.now() });

        return NextResponse.json({ channels: formattedChannels });

    } catch (error) {
        logger.error("Error fetching channels", { 
            error: error instanceof Error ? error.message : String(error),
            guildId 
        });
        return NextResponse.json({ 
            error: "Internal Server Error",
            channels: []
        }, { status: 500 });
    }
}
