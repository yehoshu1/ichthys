import cron from "node-cron";
import { db } from "../../shared/database/client";
import { discordUserCache } from "../../shared/database/schema";
import { lt } from "drizzle-orm";
import logger from "../utils/logger";

const CACHE_MAX_AGE_DAYS = 7;

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

            const result = await db
                .delete(discordUserCache)
                .where(lt(discordUserCache.updatedAt, cutoffDate))
                .returning({ count: discordUserCache.userId });

            const deletedCount = result.length;

            logger.info(`User cache cleanup completed. Removed ${deletedCount} stale entries older than ${CACHE_MAX_AGE_DAYS} days.`);
        } catch (error) {
            logger.error("Error during user cache cleanup:", error);
        }
    });

    logger.info("User cache cleanup job scheduled (daily at 2:00 AM)");
}
