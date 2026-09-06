import cron from "node-cron";
import logger from "../utils/logger";
import { db } from "../../shared/database/client";
import { guildConfig, userJoin } from "../../shared/database/schema";
import { eq, sql } from "drizzle-orm";
import { isModuleEnabled } from "@shared/modules/state";

const CHUNK_SIZE = 50;
let isRunning = false;

interface DiscordGuildMember {
    user: {
        id: string;
        bot?: boolean;
    };
    joined_at?: string;
    roles: string[];
}

async function syncGuildMemberSnapshot(guildId: string, verificationRoleId: string | null): Promise<void> {
    const token = process.env.DISCORD_TOKEN;
    if (!token) {
        logger.warn("Skipping analytics sync: DISCORD_TOKEN missing.");
        return;
    }

    let response: Response;
    try {
        response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, {
            headers: {
                Authorization: `Bot ${token}`,
            },
        });
    } catch (error) {
        logger.error(`Analytics sync failed for guild ${guildId}:`, error);
        return;
    }

    if (!response.ok) {
        logger.warn(`Analytics sync failed for guild ${guildId}: Discord status ${response.status}`);
        return;
    }

    const members = await response.json() as DiscordGuildMember[];
    if (members.length === 0) {
        await db.update(guildConfig)
            .set({ lastMemberSync: new Date(), updatedAt: new Date() })
            .where(eq(guildConfig.guildId, guildId));
        return;
    }

    const rows = members.map((member) => ({
        guildId,
        userId: member.user.id,
        joinedAt: member.joined_at ? new Date(member.joined_at) : new Date(),
        isVerified: verificationRoleId ? member.roles.includes(verificationRoleId) : false,
        isBot: Boolean(member.user.bot),
        updatedAt: new Date(),
    }));

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        await db.insert(userJoin)
            .values(chunk)
            .onConflictDoUpdate({
                target: [userJoin.guildId, userJoin.userId],
                set: {
                    joinedAt: sql`excluded.joined_at`,
                    isVerified: sql`excluded.is_verified`,
                    isBot: sql`excluded.is_bot`,
                    updatedAt: new Date(),
                },
                where: sql`${userJoin.joinedAt} IS DISTINCT FROM excluded.joined_at
                    OR ${userJoin.isVerified} IS DISTINCT FROM excluded.is_verified
                    OR ${userJoin.isBot} IS DISTINCT FROM excluded.is_bot`,
            });
    }

    await db.update(guildConfig)
        .set({ lastMemberSync: new Date(), updatedAt: new Date() })
        .where(eq(guildConfig.guildId, guildId));

    logger.info(`Analytics sync updated ${members.length} members for guild ${guildId}`);
}

export async function syncAnalyticsOnce(): Promise<void> {
    const configs = await db.select({
        guildId: guildConfig.guildId,
        verificationRoleId: guildConfig.verificationRoleId,
    }).from(guildConfig);

    for (const config of configs) {
        const analyticsEnabled = await isModuleEnabled(config.guildId, 'analytics');
        if (!analyticsEnabled) continue;

        await syncGuildMemberSnapshot(config.guildId, config.verificationRoleId);
    }
}

export function setupAnalyticsSyncJob(): void {
    cron.schedule("*/10 * * * *", async () => {
        if (isRunning) {
            logger.warn("Skipping analytics sync because previous run is still active.");
            return;
        }

        isRunning = true;
        try {
            logger.info("Starting analytics sync job...");
            await syncAnalyticsOnce();
            logger.info("Analytics sync job completed.");
        } catch (error) {
            logger.error("Analytics sync job failed:", error);
        } finally {
            isRunning = false;
        }
    });
}
