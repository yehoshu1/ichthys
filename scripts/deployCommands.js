const { REST, Routes } = require('discord.js');
const { config } = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
config();

const commands = [];

// Determine if we're in dev or prod
const isDev = process.env.NODE_ENV !== 'production';
const commandsPath = isDev 
    ? path.join(__dirname, '../src/bot/commands')
    : path.join(__dirname, '../dist/bot/commands');

// Check if path exists
if (!fs.existsSync(commandsPath)) {
    console.error(`❌ Commands directory not found at: ${commandsPath}`);
    process.exit(1);
}

const commandFiles = fs.readdirSync(commandsPath).filter((file) =>
    (file.endsWith('.ts') || file.endsWith('.js')) &&
    !file.endsWith('.test.ts') &&
    !file.endsWith('.test.js') &&
    !file.endsWith('.spec.ts') &&
    !file.endsWith('.spec.js') &&
    !file.endsWith('.d.ts')
);

console.log(`📂 Loading commands from: ${commandsPath}`);

// Load all command data
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const commandModule = require(filePath);
    const command = commandModule.default || commandModule[Object.keys(commandModule)[0]];

    if (command && 'data' in command) {
        commands.push(command.data.toJSON());
        console.log(`📝 Loaded command data: ${command.data.name}`);
    }
}

// Create REST client
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Deploy commands
(async () => {
    try {
        console.log(`🚀 Started refreshing ${commands.length} application (/) commands.`);

        let data;

        // Deploy to specific guild (faster for testing) or globally
        if (process.env.GUILD_ID) {
            data = await rest.put(
                Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.GUILD_ID),
                { body: commands },
            );
            console.log(`✅ Successfully reloaded commands to guild ${process.env.GUILD_ID}`);
        } else {
            data = await rest.put(
                Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
                { body: commands },
            );
            console.log(`✅ Successfully reloaded commands globally (may take up to 1 hour to propagate)`);
        }

        console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
        process.exit(1);
    }
})();
