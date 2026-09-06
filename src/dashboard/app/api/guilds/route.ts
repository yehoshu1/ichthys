import { NextRequest, NextResponse } from "next/server";
import { db } from "@shared/database/client";
import { guildConfig } from "@shared/database/schema";
import { dashboardRbacConfig } from "@/lib/db";
import { inArray } from "drizzle-orm";
import { requireSession } from "@/lib/guild-auth";
import logger from "@/lib/logger";
import { discordCache, dedupeRequest } from "@/lib/discord-cache";

// Discord API permissions
const MANAGE_GUILD = 0x20;

interface DiscordGuild {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string;
}

export interface Guild {
    id: string;
    name: string;
    icon: string | null;
    iconUrl: string | null;
    hasManagePermission: boolean;
    botPresent: boolean;
}

async function fetchUserGuilds(accessToken: string, userId: string): Promise<Guild[]> {
    const cacheKey = `guilds:${userId}`;
    
    // Check cache first
    const cached = discordCache.get<Guild[]>(cacheKey);
    if (cached) {
        logger.info(`Cache hit for user guilds ${userId}`);
        return cached;
    }

    return dedupeRequest(cacheKey, async () => {
        const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
            if (response.status === 429) {
                const retryAfter = response.headers.get('retry-after');
                logger.warn("Rate limited on guilds list", { retryAfter });
                throw new Error(`RATE_LIMIT:${retryAfter || '5'}`);
            }
            const errorText = await response.text();
            logger.error("Discord API error", { status: response.status, error: errorText });
            throw new Error(`DISCORD_API_${response.status}`);
        }

        const discordGuilds: DiscordGuild[] = await response.json();

        // Manage-Server users see the guild unconditionally.
        const manageableGuilds = discordGuilds.filter((guild) => {
            const permissions = BigInt(guild.permissions);
            return guild.owner || (permissions & BigInt(MANAGE_GUILD)) !== BigInt(0);
        });

        // Members without Manage Server can still enter guilds where RBAC is
        // enabled and rules may grant them module access. Detect candidate
        // guilds with a single DB query (no per-guild Discord calls): the
        // actual allow/deny decision is made by the entry gate and /me/access.
        const memberGuildIds = discordGuilds
            .filter((g) => !manageableGuilds.some((m) => m.id === g.id))
            .map((g) => g.id);

        let rbacGuildIds = new Set<string>();
        if (memberGuildIds.length > 0) {
            const rbacConfigs = await db
                .select({ guildId: dashboardRbacConfig.guildId })
                .from(dashboardRbacConfig)
                .where(inArray(dashboardRbacConfig.guildId, memberGuildIds));
            rbacGuildIds = new Set(rbacConfigs.map((c) => c.guildId));
        }

        const visibleGuilds = discordGuilds.filter(
            (guild) =>
                manageableGuilds.some((m) => m.id === guild.id) || rbacGuildIds.has(guild.id)
        );

        // Get guild IDs to check which ones have the bot
        const guildIds = visibleGuilds.map((g) => g.id);

        // Check database for guild configs (indicates bot is present)
        const botGuildConfigs = guildIds.length > 0
            ? await db
                .select({ guildId: guildConfig.guildId })
                .from(guildConfig)
                .where(inArray(guildConfig.guildId, guildIds))
            : [];

        const botGuildIds = new Set(botGuildConfigs.map((g) => g.guildId));

        // Transform guilds with bot presence info
        const guilds: Guild[] = visibleGuilds.map((guild) => ({
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            iconUrl: guild.icon
                ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${guild.icon.startsWith("a_") ? "gif" : "png"}`
                : null,
            hasManagePermission:
                guild.owner ||
                (BigInt(guild.permissions) & BigInt(MANAGE_GUILD)) !== BigInt(0),
            botPresent: botGuildIds.has(guild.id),
        }));

        // Cache for 30 seconds
        discordCache.set(cacheKey, guilds, 30_000);
        return guilds;
    });
}

export async function GET(req: NextRequest) {
    const sessionResult = await requireSession(req);
    if ("response" in sessionResult) return sessionResult.response;

    try {
        const guilds = await fetchUserGuilds(sessionResult.accessToken, sessionResult.userId);
        return NextResponse.json(guilds);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.startsWith("RATE_LIMIT:")) {
                const retryAfter = error.message.split(":")[1];
                return NextResponse.json(
                    { error: "Rate limited by Discord. Please try again." },
                    { status: 429, headers: { 'Retry-After': retryAfter } }
                );
            }
        }
        
        logger.error("Error fetching guilds", { error });
        return NextResponse.json(
            { error: "Failed to fetch guilds from Discord" },
            { status: 500 }
        );
    }
}
