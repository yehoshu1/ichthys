import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Command } from './types/Command';

// Extend the Discord.js Client type to include commands collection
declare module 'discord.js' {
    export interface Client {
        commands?: Collection<string, Command>;
    }
}

// Load environment variables
config();

// Create Discord client with necessary intents
const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    presence: {
        status: 'online',
        activities: [{ name: '/ping for latency', type: 0 }]
    }
});

// Initialize commands collection
client.commands = new Collection();

// Load commands dynamically
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const commandModule = require(filePath);

    // Get the command export (handle both default and named exports)
    const command = commandModule.default || commandModule[Object.keys(commandModule)[0]];

    if (command && 'data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`📝 Loaded command: ${command.data.name}`);
    } else {
        console.warn(`⚠️  The command at ${filePath} is missing required "data" or "execute" property.`);
    }
}

// Load events dynamically
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath).default;

    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
    console.log(`🎯 Registered event: ${event.name}`);
}

// Login to Discord
client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('❌ Failed to login:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down gracefully...');
    client.destroy();
    process.exit(0);
});
