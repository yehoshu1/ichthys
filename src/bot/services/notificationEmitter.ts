import logger from '../utils/logger';
import {
    type EmitGuildNotificationInput,
    emitGuildNotification,
} from '../../shared/services/notification-service';

export async function emitGuildNotificationSafe(input: EmitGuildNotificationInput): Promise<void> {
    try {
        await emitGuildNotification(input);
    } catch (error) {
        logger.warn(`Failed to emit notification ${input.eventType} for guild ${input.guildId}:`, error);
    }
}

