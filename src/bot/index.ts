import 'dotenv/config';
import client from './client';
import logger from './utils/logger';

// Validate required environment variables
const requiredEnvVars = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    process.exit(1);
}

// Login to Discord
async function startBot() {
    try {
        // Load commands and event handlers
        const { loadCommands } = await import('./utils/commandLoader');
        const { default: setupInteractionHandler } = await import('./events/interactionCreate');
        const { default: setupGuildMemberUpdateHandler } = await import('./events/guildMemberUpdate');
        const { default: setupGuildMemberAddHandler } = await import('./events/guildMemberAdd');
        const { default: setupGuildMemberRemoveHandler } = await import('./events/guildMemberRemove');
        const { default: startCleanupJob } = await import('./jobs/cleanupUnverified');
        const { setupBoostCleanupJob } = await import('./jobs/cleanupBoosts');
        const { default: setupMessageCreateHandler } = await import('./events/messageCreate');
        const { default: setupVoiceStateUpdateHandler } = await import('./events/voiceStateUpdate');

        await loadCommands();
        setupInteractionHandler();
        setupGuildMemberUpdateHandler();
        setupGuildMemberAddHandler();
        setupGuildMemberRemoveHandler();
        setupMessageCreateHandler();
        setupVoiceStateUpdateHandler();
        startCleanupJob();
        setupBoostCleanupJob();

        logger.info('🚀 Starting ΙΧΘΥΣ Discord Bot...');
        await client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
        logger.error('Failed to start bot:', error);
        process.exit(1);
    }
}

startBot();
