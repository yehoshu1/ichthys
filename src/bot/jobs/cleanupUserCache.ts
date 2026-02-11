import cron from "node-cron";
import { db } from "../../shared/database/client";
import { discordUserCache } from "../../shared/database/schema";
import { lt, sql } from "drizzle-orm";
import logger from "../utils/logger";

const CACHE_MAX_AGE_DAYS = 30; // 🎯 PERFORMANCE FIX: Extended from 7 to 30 days for better cache hit rate
const CLEANUP_BATCH_SIZE = 1000; // 🎯 PERFORMANCE FIX: Process in batches

/**
 * Clean up old user cache entries to prevent database bloat
 * Runs daily at 2:00 AM
 */
export default function startUserCacheCleanupJob() {
    cron.schedule("0 2 * * *", async () => {
        logger.info("Starting user cache cleanup job...");

        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - CACHE_MAX_AGE_DAYS);

            // 🎯 PERFORMANCE FIX: Get count before deletion for logging
            const countResult = await db
                .select({ count: sql<number>`count(*)` })
                .from(discordUserCache)
                .where(lt(discordUserCache.updatedAt, cutoffDate));

            const toDeleteCount = countResult[0]?.count || 0;

            if (toDeleteCount === 0) {
                logger.info("No stale user cache entries to clean up.");
                return;
            }

            logger.info(`Found ${toDeleteCount} stale user cache entries to clean up.`);

            // 🎯 PERFORMANCE FIX: Delete in batches using subquery to avoid long-running transaction
            let totalDeleted = 0;
            let hasMore = true;
            const maxIterations = Math.ceil(toDeleteCount / CLEANUP_BATCH_SIZE) + 1;
            let iterations = 0;

            while (hasMore && iterations < maxIterations) {
                iterations++;

                // Use a subquery to limit the delete
                const result = await db
                    .delete(discordUserCache)
                    .where(
                        sql`${discordUserCache.userId} IN (
                            SELECT user_id FROM discord_user_cache
                            WHERE updated_at < ${cutoffDate}
                            LIMIT ${CLEANUP_BATCH_SIZE}
                        )`
                    )
                    .returning({ userId: discordUserCache.userId });

                const batchDeleted = result.length;
                totalDeleted += batchDeleted;

                if (batchDeleted < CLEANUP_BATCH_SIZE) {
                    hasMore = false;
                }

                // Small delay between batches
                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            logger.info(`User cache cleanup completed. Removed ${totalDeleted} stale entries older than ${CACHE_MAX_AGE_DAYS} days.`);
        } catch (error) {
            logger.error("Error during user cache cleanup:", error);
        }
    });

    logger.info("User cache cleanup job scheduled (daily at 2:00 AM)");
}

/**
 * Manually trigger cache cleanup (for admin commands)
 */
export async function triggerUserCacheCleanup(maxAgeDays: number = CACHE_MAX_AGE_DAYS): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    const result = await db
        .delete(discordUserCache)
        .where(lt(discordUserCache.updatedAt, cutoffDate))
        .returning({ userId: discordUserCache.userId });

    return result.length;
}

/**
 * Get cache statistics
 */
export async function getUserCacheStats(): Promise<{ total: number; stale: number }> {
    const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(discordUserCache);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CACHE_MAX_AGE_DAYS);

    const staleResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(discordUserCache)
        .where(lt(discordUserCache.updatedAt, cutoffDate));

    return {
        total: totalResult[0]?.count || 0,
        stale: staleResult[0]?.count || 0
    };
}
