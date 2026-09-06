import { NextRequest, NextResponse } from "next/server";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import logger from "@/lib/logger";
import { getToken } from "next-auth/jwt";
import { emitGuildNotification } from "@shared/services/notification-service";

const CACHE_TTL = 300 * 1000; // 5 minutes
const cache = new Map<string, { data: DiscordData, timestamp: number }>();

interface DiscordApiRole {
    id: string;
    name: string;
    color: number;
    position: number;
}

interface DiscordApiChannel {
    id: string;
    name: string;
    type: number;
    position?: number;
}

interface DiscordData {
    roles: Array<{
        id: string;
        name: string;
        color: number;
        position: number;
    }>;
    channels: Array<{
        id: string;
        name: string;
        type: number;
        position: number;
    }>;
}

async function fetchWithBotToken(
    guildId: string,
    botToken: string
): Promise<{ data: { roles: DiscordApiRole[]; channels: DiscordApiChannel[] } | null; missingPermissions: boolean }> {
    try {
        const [rolesResponse, channelsResponse] = await Promise.all([
            fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
                headers: { Authorization: `Bot ${botToken}` },
            }),
            fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
                headers: { Authorization: `Bot ${botToken}` },
            })
        ]);

        if (!rolesResponse.ok || !channelsResponse.ok) {
            logger.warn("Bot token Discord API failed", {
                rolesStatus: rolesResponse.status,
                channelsStatus: channelsResponse.status,
                guildId
            });
            return {
                data: null,
                missingPermissions: rolesResponse.status === 403 || channelsResponse.status === 403,
            };
        }

        const roles = await rolesResponse.json() as DiscordApiRole[];
        const channels = await channelsResponse.json() as DiscordApiChannel[];

        return {
            data: { roles, channels },
            missingPermissions: false,
        };
    } catch (error) {
        logger.error("Bot token fetch failed", { error, guildId });
        return {
            data: null,
            missingPermissions: false,
        };
    }
}

async function fetchWithUserToken(guildId: string, userToken: string): Promise<{ roles: DiscordApiRole[]; channels: DiscordApiChannel[] } | null> {
    try {
        // Fetch guild info which includes roles for the user
        const guildResponse = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });

        if (!guildResponse.ok) {
            logger.warn("User token guild member fetch failed", {
                status: guildResponse.status,
                guildId
            });
            return null;
        }

        // Also fetch channels via user token
        const channelsResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });

        // Fetch roles - we need to get them from the guild endpoint
        const guildRolesResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });

        let roles: DiscordApiRole[] = [];
        let channels: DiscordApiChannel[] = [];

        if (guildRolesResponse.ok) {
            const guildData = await guildRolesResponse.json() as { roles?: DiscordApiRole[] };
            roles = guildData.roles || [];
        }

        if (channelsResponse.ok) {
            channels = await channelsResponse.json() as DiscordApiChannel[];
        }

        return { roles, channels };
    } catch (error) {
        logger.error("User token fetch failed", { error, guildId });
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
        return NextResponse.json(cached.data);
    }

    try {
        const botToken = process.env.DISCORD_TOKEN;
        let result: { roles: DiscordApiRole[]; channels: DiscordApiChannel[] } | null = null;
        let botMissingPermissions = false;

        // Try bot token first (preferred - has higher rate limits)
        if (botToken) {
            const botResult = await fetchWithBotToken(guildId, botToken);
            result = botResult.data;
            botMissingPermissions = botResult.missingPermissions;
        }

        // If bot token failed or not configured, try user token as fallback
        if (!result) {
            const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
            const userToken = token?.accessToken as string | undefined;
            
            if (userToken) {
                result = await fetchWithUserToken(guildId, userToken);
            }
        }

        if (botMissingPermissions) {
            await emitGuildNotification({
                guildId,
                eventType: 'GUILD_BOT_MISSING_PERMISSIONS',
                severity: 'ERROR',
                source: 'DASHBOARD_API',
                title: 'Bot is missing required guild permissions',
                actorUserId: auth.userId,
                dedupeKey: `guild-bot-missing-permissions:${guildId}`,
                dedupeWindowSeconds: 600,
            });
        }

        // If both failed, return error
        if (!result) {
            // If we have stale cache, serve it
            if (cached) {
                logger.warn("Serving stale discord-data cache", { guildId });
                return NextResponse.json(cached.data);
            }

            logger.error("Failed to fetch Discord data - bot not in server or no access", { guildId });
            return NextResponse.json({ 
                error: "Bot is not in this server. Please invite the bot first.",
                roles: [],
                channels: []
            }, { status: 404 });
        }

        // Filter and format roles (exclude @everyone, sort by position)
        const formattedRoles = result.roles
            .filter((role) => role.name !== "@everyone")
            .sort((a, b) => b.position - a.position)
            .map((role) => ({
                id: role.id,
                name: role.name,
                color: role.color,
                position: role.position
            }));

        // Filter and format channels
        // Channel types:
        // 0 = GUILD_TEXT, 2 = GUILD_VOICE, 5 = GUILD_ANNOUNCEMENT,
        // 10 = ANNOUNCEMENT_THREAD, 11 = PUBLIC_THREAD, 12 = PRIVATE_THREAD, 13 = GUILD_STAGE_VOICE
        const allowedChannelTypes = [0, 2, 5, 10, 11, 12, 13];
        const formattedChannels = result.channels
            .filter((channel) => allowedChannelTypes.includes(channel.type))
            .sort((a, b) => (a.position || 0) - (b.position || 0))
            .map((channel) => ({
                id: channel.id,
                name: channel.name,
                type: channel.type,
                position: channel.position || 0
            }));

        const responseData = {
            roles: formattedRoles,
            channels: formattedChannels
        };

        // Update cache
        cache.set(guildId, { data: responseData, timestamp: Date.now() });

        return NextResponse.json(responseData);

    } catch (error) {
        logger.error("Error fetching Discord data", { 
            error: error instanceof Error ? error.message : String(error),
            guildId 
        });
        return NextResponse.json({ 
            error: "Internal Server Error",
            roles: [],
            channels: []
        }, { status: 500 });
    }
}
