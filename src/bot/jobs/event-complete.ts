import { Client } from 'discord.js';
import { eventService } from '../services/event-service';
import logger from '../utils/logger';
import { isModuleEnabled } from '@shared/modules/state';

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT COMPLETION JOB
// Marks active events as completed once their effective end time has passed
// ═══════════════════════════════════════════════════════════════════════════════

export const name = 'event-complete';
export const schedule = '*/1 * * * *'; // Run every minute

function getEffectiveEndTime(eventData: {
    startTime: Date;
    endTime: Date | null;
    durationMinutes: number | null;
}): Date {
    if (eventData.endTime) {
        return eventData.endTime;
    }

    const minutes = eventData.durationMinutes && eventData.durationMinutes > 0
        ? eventData.durationMinutes
        : 60;
    return new Date(eventData.startTime.getTime() + minutes * 60_000);
}

export async function execute(_client: Client) {
    try {
        const now = new Date();
        const activeEvents = await eventService.getActiveEvents();

        for (const evt of activeEvents) {
            const eventsEnabled = await isModuleEnabled(evt.guildId, 'events');
            if (!eventsEnabled) {
                continue;
            }

            const effectiveEndTime = getEffectiveEndTime(evt);
            if (effectiveEndTime <= now) {
                await eventService.markEventAsCompleted(evt.id);
                logger.info(`Marked event ${evt.id} as completed`);
            }
        }
    } catch (error) {
        logger.error('Error in event completion job:', error);
    }
}
