import { Client, GatewayIntentBits, Events, Collection } from 'discord.js';
import logger from './utils/logger';
import { guildConfigService } from './services/guildConfigService';

// Create Discord client with required intents
export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
    ],
});

// Store commands in a collection
client.commands = new Collection();

// Ready event
client.once(Events.ClientReady, async (readyClient) => {
    logger.info(`✅ Bot is ready! Logged in as ${readyClient.user.tag}`);
    logger.info(`📊 Serving ${readyClient.guilds.cache.size} guilds`);

    // Set bot status
    readyClient.user.setPresence({
        activities: [{ name: 'over the flock', type: 3 }], // Type 3 = Watching
        status: 'online',
    });

    // Initialize guild configs for all guilds the bot is in
    for (const guild of readyClient.guilds.cache.values()) {
        try {
            await guildConfigService.getGuildConfig(guild.id);
            logger.debug(`Initialized config for guild: ${guild.name} (${guild.id})`);
        } catch (error) {
            logger.error(`Failed to initialize config for guild ${guild.id}:`, error);
        }
    }
});

// Guild Create event - bot joins a server
client.on(Events.GuildCreate, async (guild) => {
    logger.info(`✨ Joined new guild: ${guild.name} (${guild.id})`);

    try {
        await guildConfigService.createGuildConfig(guild.id);
        logger.info(`Created config for guild: ${guild.name}`);
    } catch (error) {
        logger.error(`Failed to create config for guild ${guild.id}:`, error);
    }
});

// Guild Delete event - bot leaves/removed from a server
client.on(Events.GuildDelete, async (guild) => {
    logger.info(`👋 Left guild: ${guild.name} (${guild.id})`);

    try {
        await guildConfigService.deleteGuildConfig(guild.id);
        logger.info(`Deleted config for guild: ${guild.name}`);
    } catch (error) {
        logger.error(`Failed to delete config for guild ${guild.id}:`, error);
    }
});

// Error event
client.on(Events.Error, (error) => {
    logger.error('Discord client error:', error);
});

// Warn event
client.on(Events.Warn, (info) => {
    logger.warn('Discord client warning:', info);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('🛑 Shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('🛑 Shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

export default client;
