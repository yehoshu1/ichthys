import fs from 'fs';
import path from 'path';
import client from '../client';
import logger from './logger';
import type { Event } from '../types/Event';

/**
 * Load all events from the events directory
 * Following Discord.js builder skill patterns
 */
export async function loadEvents() {
    const eventsPath = path.join(__dirname, '../events');

    if (!fs.existsSync(eventsPath)) {
        logger.warn(`Events directory not found at ${eventsPath}`);
        return;
    }

    const eventFiles = fs.readdirSync(eventsPath).filter(file => 
        file.endsWith('.ts') || file.endsWith('.js')
    );

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        try {
            // Dynamic import for TS/JS compatibility
            const eventModule = await import(filePath);
            const event: Event = eventModule.default || eventModule[Object.keys(eventModule)[0]];

            if (event && 'name' in event && 'execute' in event) {
                if (event.once) {
                    client.once(event.name, (...args) => event.execute(...args));
                } else {
                    client.on(event.name, (...args) => event.execute(...args));
                }
                logger.debug(`Loaded event: ${event.name}${event.once ? ' (once)' : ''}`);
            } else {
                logger.warn(`The event at ${filePath} is missing a required "name" or "execute" property.`);
            }
        } catch (error) {
            logger.error(`Failed to load event ${file}:`, error);
        }
    }

    logger.info(`🎧 Loaded ${eventFiles.length} event handlers`);
}
