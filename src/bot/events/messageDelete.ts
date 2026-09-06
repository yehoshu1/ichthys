import { Events, Message, PartialMessage } from 'discord.js';
import type { Event } from '../types/Event';
import { commandReplyCleanupService } from '../services/commandReplyCleanupService';

const event: Event<Events.MessageDelete> = {
    name: Events.MessageDelete,
    async execute(message: Message | PartialMessage) {
        await commandReplyCleanupService.handleMessageDeleted(message);
    },
};

export default event;
