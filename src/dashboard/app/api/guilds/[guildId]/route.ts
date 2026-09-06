import { NextRequest, NextResponse } from "next/server";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import logger from "../../../../lib/logger";
import { discordCache, dedupeRequest } from "@/lib/discord-cache";
import { emitGuildNotification } from "@shared/services/notification-service";

interface DiscordGuild {
    id: string;
    name: string;
    icon: string | null;
}

interface GuildResult {
    id: string;
    name: string;
    icon: string | null;
    iconUrl: string | null;
    isBotMember: boolean;
}

async function fetchGuildData(guildId: string, auth: { accessToken: string }): Promise<GuildResult> {
    const cacheKey = `guild:${guildId}`;
    
    // Check cache first
    const cached = discordCache.get<GuildResult>(cacheKey);
    if (cached) {
        logger.info(`Cache hit for guild ${guildId}`);
        return cached;
    }

    return dedupeRequest(cacheKey, async () => {
        let guild: DiscordGuild | null = null;
        let isBotMember = false;

        // Try bot token first (higher rate limits)
        const botToken = process.env.DISCORD_TOKEN;
        if (botToken) {
            try {
                logger.info(`Trying bot token for guild ${guildId}`);
                const botRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
                    headers: { Authorization: `Bot ${botToken}` },
                });
                
                if (botRes.ok) {
                    guild = await botRes.json();
                    isBotMember = true;
                    logger.info(`Bot token succeeded for guild ${guildId}`);
                } else {
                    logger.warn(`Bot token failed: ${botRes.status}`, { guildId });
                }
            } catch (error) {
                logger.error("Bot guild fetch failed", { error, guildId });
            }
        }

        // Fallback to user token
        if (!guild) {
            try {
                logger.info(`Trying user token for guild ${guildId}`);
                const userRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
                    headers: { Authorization: `Bearer ${auth.accessToken}` },
                });

                if (!userRes.ok) {
                    if (userRes.status === 429) {
                        const retryAfter = userRes.headers.get('retry-after');
                        logger.warn("Rate limited", { guildId, retryAfter });
                        throw new Error(`RATE_LIMIT:${retryAfter || '5'}`);
                    }
                    if (userRes.status === 403) {
                        throw new Error("FORBIDDEN");
                    }
                    throw new Error(`HTTP_${userRes.status}`);
                }

                guild = await userRes.json();
            } catch (error) {
                if (error instanceof Error && error.message.startsWith("RATE_LIMIT:")) {
                    throw error;
                }
                if (error instanceof Error && error.message === "FORBIDDEN") {
                    throw error;
                }
                logger.error("User guild fetch failed", { error, guildId });
                throw new Error("FETCH_FAILED");
            }
        }

        if (!guild) {
            throw new Error("NO_GUILD");
        }

        const result: GuildResult = {
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            iconUrl: guild.icon
                ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
                : null,
            isBotMember,
        };

        // Cache for 30 seconds
        discordCache.set(cacheKey, result, 30_000);
        return result;
    });
}

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    
    logger.info(`Fetching guild info for ${guildId}`);
    
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) {
        return auth.response;
    }

    try {
        const result = await fetchGuildData(guildId, { accessToken: auth.accessToken });
        if (!result.isBotMember) {
            await emitGuildNotification({
                guildId,
                eventType: 'GUILD_BOT_MISSING_IN_GUILD',
                severity: 'CRITICAL',
                source: 'DASHBOARD_API',
                title: 'Bot is not in this guild',
                actorUserId: auth.userId,
                dedupeKey: `guild-bot-missing:${guildId}`,
                dedupeWindowSeconds: 600,
            });
        }
        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.startsWith("RATE_LIMIT:")) {
                const retryAfter = error.message.split(":")[1];
                return NextResponse.json(
                    { error: "Rate limited. Please try again." },
                    { status: 429, headers: { 'Retry-After': retryAfter } }
                );
            }
            if (error.message === "FORBIDDEN") {
                return NextResponse.json(
                    { error: "No access to this server" },
                    { status: 403 }
                );
            }
            if (error.message === "NO_GUILD" || error.message === "FETCH_FAILED") {
                await emitGuildNotification({
                    guildId,
                    eventType: 'GUILD_BOT_MISSING_IN_GUILD',
                    severity: 'CRITICAL',
                    source: 'DASHBOARD_API',
                    title: 'Bot is not in this guild',
                    actorUserId: auth.userId,
                    dedupeKey: `guild-bot-missing:${guildId}`,
                    dedupeWindowSeconds: 600,
                }).catch((error) => { logger.warn(`Failed to emit guild notification for missing bot:`, error); return null; });
                return NextResponse.json(
                    { error: "Bot not in server" },
                    { status: 404 }
                );
            }
        }
        
        logger.error("Failed to fetch guild", { error, guildId });
        return NextResponse.json(
            { error: "Failed to fetch guild information" },
            { status: 503 }
        );
    }
}
