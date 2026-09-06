import cron from "node-cron";
import { db } from "../../shared/database/client";
import { guildGrowth, userJoin, guildConfig } from "../../shared/database/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import client from "../client";
import logger from "../utils/logger";
import { isModuleEnabled } from "@shared/modules/state";

/**
 * Track daily guild growth metrics
 * Runs daily at midnight (00:00)
 */
export default function startGrowthTrackingJob() {
    cron.schedule("0 0 * * *", async () => {
        logger.info("Starting daily growth tracking...");

        try {
            const configs = await db.select().from(guildConfig);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            for (const config of configs) {
                try {
                    const analyticsEnabled = await isModuleEnabled(config.guildId, 'analytics');
                    if (!analyticsEnabled) continue;

                    const guild = client.guilds.cache.get(config.guildId);
                    if (!guild) {
                        logger.debug(`Guild ${config.guildId} not in cache, skipping growth tracking`);
                        continue;
                    }

                    // Get current member count
                    const memberCount = guild.memberCount;

                    // Get verified count
                    const verifiedResult = await db
                        .select({ count: sql<number>`count(*)` })
                        .from(userJoin)
                        .where(and(
                            eq(userJoin.guildId, config.guildId),
                            eq(userJoin.isVerified, true)
                        ));
                    const verifiedCount = verifiedResult[0]?.count || 0;

                    // Get joins today (since yesterday midnight)
                    const joinsResult = await db
                        .select({ count: sql<number>`count(*)` })
                        .from(userJoin)
                        .where(and(
                            eq(userJoin.guildId, config.guildId),
                            gte(userJoin.joinedAt, yesterday)
                        ));
                    const joinedToday = joinsResult[0]?.count || 0;

                    // Get leaves (approximated from kickedAt since yesterday)
                    const leavesResult = await db
                        .select({ count: sql<number>`count(*)` })
                        .from(userJoin)
                        .where(and(
                            eq(userJoin.guildId, config.guildId),
                            gte(userJoin.kickedAt, yesterday)
                        ));
                    const leftToday = leavesResult[0]?.count || 0;

                    // Insert or update growth record
                    await db.insert(guildGrowth)
                        .values({
                            guildId: config.guildId,
                            date: today,
                            memberCount,
                            verifiedCount,
                            joinedToday,
                            leftToday,
                        })
                        .onConflictDoUpdate({
                            target: [guildGrowth.guildId, guildGrowth.date],
                            set: {
                                memberCount,
                                verifiedCount,
                                joinedToday,
                                leftToday,
                            },
                            where: sql`${guildGrowth.memberCount} IS DISTINCT FROM excluded.member_count
                                OR ${guildGrowth.verifiedCount} IS DISTINCT FROM excluded.verified_count
                                OR ${guildGrowth.joinedToday} IS DISTINCT FROM excluded.joined_today
                                OR ${guildGrowth.leftToday} IS DISTINCT FROM excluded.left_today`,
                        });

                    logger.debug(`Tracked growth for ${guild.name}: ${memberCount} members, ${joinedToday} joins, ${leftToday} leaves`);
                } catch (error) {
                    logger.error(`Failed to track growth for guild ${config.guildId}:`, error);
                }
            }

            logger.info(`Growth tracking completed for ${configs.length} guilds`);
        } catch (error) {
            logger.error("Error in growth tracking job:", error);
        }
    });

    logger.info("Growth tracking job scheduled (daily at 00:00)");
}
