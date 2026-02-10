/**
 * Bot Client Access for Dashboard API
 * 
 * This module provides access to the Discord bot client from the dashboard API routes.
 * The bot client is set when the bot starts up and is available for sending messages,
 * fetching guild data, etc.
 */

import { Client } from "discord.js";

// Global bot client reference
let botClientRef: Client | null = null;

/**
 * Set the bot client reference (called from bot startup)
 */
export function setBotClient(client: Client): void {
    botClientRef = client;
}

/**
 * Get the bot client (for use in dashboard API routes)
 */
export function getBotClient(): Client | null {
    return botClientRef;
}

/**
 * Bot client export for dashboard API routes
 * Returns null if bot is not connected
 */
export const botClient = botClientRef;

// Re-export for convenience
export { botClientRef };
