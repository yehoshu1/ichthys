import { ClientEvents } from 'discord.js';

/**
 * Event interface for Discord.js event handlers
 * Following Discord.js builder skill patterns
 */
export interface Event<K extends keyof ClientEvents = keyof ClientEvents> {
    name: K;
    once?: boolean;
    execute: (...args: ClientEvents[K]) => Promise<void> | void;
}
