import 'dotenv/config';
import cron from 'node-cron';
import client from './client';
import logger from './utils/logger';
import { checkBirthdays, removeExpiredBirthdayRoles } from './jobs/checkBirthdays';

function setupBirthdayJobs(): void {
    // Check birthdays hourly so each guild can run at its configured hour.
    cron.schedule('0 * * * *', async () => {
        try {
            await checkBirthdays(client);
        } catch (error) {
            logger.error('Birthday check job failed:', error);
        }
    });

    // Remove previous-day birthday roles shortly after midnight.
    cron.schedule('5 0 * * *', async () => {
        try {
            await removeExpiredBirthdayRoles(client);
        } catch (error) {
            logger.error('Birthday role cleanup job failed:', error);
        }
    });
}

// Validate required environment variables
const requiredEnvVars = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    process.exit(1);
}

// Global error handlers for uncaught exceptions and unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Keep the process alive but log the error for monitoring
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // Give logger time to flush before exiting
    setTimeout(() => process.exit(1), 1000);
});

// Login to Discord
async function startBot() {
    try {
        // Load commands and event handlers
        const { loadCommands } = await import('./utils/commandLoader');
        const { loadEvents } = await import('./utils/eventLoader');
        const { default: startCleanupJob } = await import('./jobs/cleanupUnverified');
        const { setupBoostCleanupJob } = await import('./jobs/cleanupBoosts');
        const { setupAnalyticsSyncJob } = await import('./jobs/syncAnalytics');
        const { setupScheduledRoleActionsJob } = await import('./jobs/processScheduledRoleActions');
        const { setupModerationExpirationsJob } = await import('./jobs/processModerationExpirations');
        const { setupNotificationDeliveryJob } = await import('./jobs/processNotificationDeliveries');
        const { default: startUserCacheCleanupJob } = await import('./jobs/cleanupUserCache');
        const { default: startGrowthTrackingJob } = await import('./jobs/trackGrowth');
        const { setupVoiceXpProcessingJob } = await import('./jobs/processVoiceXp');

        await loadCommands();
        await loadEvents(); // Auto-load all events
        startCleanupJob();
        setupBoostCleanupJob();
        setupAnalyticsSyncJob();
        setupScheduledRoleActionsJob();
        setupModerationExpirationsJob();
        setupNotificationDeliveryJob();
        startUserCacheCleanupJob();
        startGrowthTrackingJob();
        setupVoiceXpProcessingJob();
        setupBirthdayJobs();

        logger.info('🚀 Starting ΙΧΘΥΣ Discord Bot...');
        await client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
        logger.error('Failed to start bot:', error);
        process.exit(1);
    }
}

startBot();
