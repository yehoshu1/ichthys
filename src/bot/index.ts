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
const requiredEnvVars = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    process.exit(1);
}

const moduleScopedEnvVars = [
    { moduleId: 'polls', envVar: 'ANONYMIZE_SECRET' },
];

for (const entry of moduleScopedEnvVars) {
    if (!process.env[entry.envVar]) {
        logger.warn(
            `Optional module environment variable ${entry.envVar} is missing. `
            + `Some ${entry.moduleId} features will be unavailable until configured.`
        );
    }
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
        const { initEventDiscordService } = await import('./services/event-discord-service');
        const { startEventMessageSync } = await import('./jobs/event-message-sync');
        const { initPollDiscordService } = await import('./services/poll-discord-service');
        const { startPollMessageSync } = await import('./jobs/poll-message-sync');

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

        // Initialize event Discord service after login
        initEventDiscordService(client);
        startEventMessageSync(client);
        
        // Initialize poll Discord service
        initPollDiscordService(client);
        startPollMessageSync(client);

        // Schedule event reminder job (run every minute)
        const { execute: runEventReminders } = await import('./jobs/event-reminders');
        cron.schedule('*/1 * * * *', async () => {
            try {
                await runEventReminders(client);
            } catch (error) {
                logger.error('Event reminders job failed:', error);
            }
        });
        logger.info('📅 Event reminders job scheduled (every minute)');

        // Schedule event start job (run every minute)
        const { execute: runEventStart } = await import('./jobs/event-start');
        cron.schedule('*/1 * * * *', async () => {
            try {
                await runEventStart(client);
            } catch (error) {
                logger.error('Event start job failed:', error);
            }
        });
        logger.info('🎉 Event start job scheduled (every minute)');

        // Schedule poll end job (run every minute)
        const { execute: runPollEnd } = await import('./jobs/poll-end');
        cron.schedule('*/1 * * * *', async () => {
            try {
                await runPollEnd(client);
            } catch (error) {
                logger.error('Poll end job failed:', error);
            }
        });
        logger.info('🔒 Poll end job scheduled (every minute)');

        // Schedule event completion job (run every minute)
        const { execute: runEventComplete } = await import('./jobs/event-complete');
        cron.schedule('*/1 * * * *', async () => {
            try {
                await runEventComplete(client);
            } catch (error) {
                logger.error('Event completion job failed:', error);
            }
        });
        logger.info('✅ Event completion job scheduled (every minute)');
    } catch (error) {
        logger.error('Failed to start bot:', error);
        process.exit(1);
    }
}

startBot();
