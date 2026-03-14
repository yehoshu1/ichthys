import fs from 'fs';
import path from 'path';
import client from '../client';
import logger from '../utils/logger';

export async function loadCommands() {
    const commandsPath = path.join(__dirname, '../commands');

    if (!fs.existsSync(commandsPath)) {
        logger.warn(`Commands directory not found at ${commandsPath}`);
        return;
    }

    const commandFiles = fs.readdirSync(commandsPath).filter((file) =>
        (file.endsWith('.ts') || file.endsWith('.js')) &&
        !file.endsWith('.test.ts') &&
        !file.endsWith('.test.js') &&
        !file.endsWith('.spec.ts') &&
        !file.endsWith('.spec.js') &&
        !file.endsWith('.d.ts')
    );

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            // Dynamic import for TS/JS compatibility
            const commandModule = await import(filePath);
            const command = commandModule.default || commandModule[Object.keys(commandModule)[0]];

            if (command && 'data' in command && 'execute' in command) {
                client.commands!.set(command.data.name, command);
                logger.debug(`Loaded command: ${command.data.name}`);
            } else {
                logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        } catch (error) {
            logger.error(`Failed to load command ${file}:`, error);
        }
    }

    logger.info(`📝 Loaded ${client.commands!.size} slash commands`);
}
