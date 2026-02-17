import type { Client } from 'discord.js';

let botClientRef: Client | null = null;

export function setBotClient(client: Client): void {
    botClientRef = client;
}

export function getBotClient(): Client | null {
    return botClientRef;
}
