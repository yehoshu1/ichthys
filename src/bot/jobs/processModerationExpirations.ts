import cron from "node-cron";
import { and, eq, inArray, lte } from "drizzle-orm";
import client from "../client";
import logger from "../utils/logger";
import { db } from "../../shared/database/client";
import { actionLog, moderationCase, moderationSettings } from "../../shared/database/schema";
import { emitGuildNotificationSafe } from "../services/notificationEmitter";
import { isModuleEnabled } from "@shared/modules/state";

const MAX_CASES_PER_RUN = 100;
const EXPIRABLE_ACTIONS = ["MUTE", "TIMEOUT", "BAN"] as const;
let isRunning = false;

function isVoiceMuteCase(modCase: typeof moderationCase.$inferSelect): boolean {
    return typeof modCase.reason === "string" && modCase.reason.startsWith("Voice mute:");
}

async function expireMuteCase(modCase: typeof moderationCase.$inferSelect): Promise<void> {
    const guild = await client.guilds.fetch(modCase.guildId).catch((error) => { logger.warn(`Failed to fetch guild ${modCase.guildId} for moderation expiration:`, error); return null; });
    if (!guild) {
        return;
    }

    const member = await guild.members.fetch(modCase.userId).catch((error) => { logger.warn(`Failed to fetch member ${modCase.userId} for moderation expiration:`, error); return null; });
    if (!member) {
        return;
    }

    if (isVoiceMuteCase(modCase)) {
        if (member.voice.serverMute) {
            await member.voice.setMute(false, "Temporary voice mute expired");
        }
        return;
    }

    const settings = await db.query.moderationSettings.findFirst({
        where: eq(moderationSettings.guildId, guild.id),
    });

    if (!settings?.muteRoleId) {
        return;
    }

    if (member.roles.cache.has(settings.muteRoleId)) {
        await member.roles.remove(settings.muteRoleId, "Temporary mute expired");
    }
}

async function expireTimeoutCase(modCase: typeof moderationCase.$inferSelect): Promise<void> {
    const guild = await client.guilds.fetch(modCase.guildId).catch((error) => { logger.warn(`Failed to fetch guild ${modCase.guildId} for moderation expiration:`, error); return null; });
    if (!guild) {
        return;
    }

    const member = await guild.members.fetch(modCase.userId).catch((error) => { logger.warn(`Failed to fetch member ${modCase.userId} for moderation expiration:`, error); return null; });
    if (!member) {
        return;
    }

    if (member.communicationDisabledUntilTimestamp) {
        await member.timeout(null, "Timeout expired");
    }
}

async function expireBanCase(modCase: typeof moderationCase.$inferSelect): Promise<void> {
    const guild = await client.guilds.fetch(modCase.guildId).catch((error) => { logger.warn(`Failed to fetch guild ${modCase.guildId} for moderation expiration:`, error); return null; });
    if (!guild) {
        return;
    }

    await guild.members.unban(modCase.userId, "Temporary ban expired").catch((error) => { logger.warn(`Failed to unban user ${modCase.userId} after temporary ban expired:`, error); return null; });
}

async function processExpiredCase(modCase: typeof moderationCase.$inferSelect): Promise<void> {
    try {
        if (modCase.action === "MUTE") {
            await expireMuteCase(modCase);
        } else if (modCase.action === "TIMEOUT") {
            await expireTimeoutCase(modCase);
        } else if (modCase.action === "BAN") {
            await expireBanCase(modCase);
        }

        await db.update(moderationCase)
            .set({ active: false })
            .where(eq(moderationCase.id, modCase.id));

        await db.insert(actionLog).values({
            guildId: modCase.guildId,
            actionType: `${modCase.action}_EXPIRED`,
            targetUserId: modCase.userId,
            success: true,
            metadata: JSON.stringify({ caseId: modCase.id, caseNumber: modCase.caseNumber }),
        });
        await emitGuildNotificationSafe({
            guildId: modCase.guildId,
            eventType: 'MOD_CASE_EXPIRED_SUCCESS',
            severity: 'INFO',
            source: 'BOT_JOB',
            title: `${modCase.action} case #${modCase.caseNumber} expired`,
            targetUserId: modCase.userId,
            metadata: {
                caseId: modCase.id,
                caseNumber: modCase.caseNumber,
                action: modCase.action,
            },
        });
    } catch (error) {
        logger.error(`Failed to expire moderation case ${modCase.id}:`, error);
        await db.insert(actionLog).values({
            guildId: modCase.guildId,
            actionType: `${modCase.action}_EXPIRED`,
            targetUserId: modCase.userId,
            success: false,
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            metadata: JSON.stringify({ caseId: modCase.id, caseNumber: modCase.caseNumber }),
        });
        await emitGuildNotificationSafe({
            guildId: modCase.guildId,
            eventType: 'MOD_CASE_EXPIRED_FAILED',
            severity: 'ERROR',
            source: 'BOT_JOB',
            title: `Failed to expire ${modCase.action} case #${modCase.caseNumber}`,
            body: error instanceof Error ? error.message : 'Unknown error',
            targetUserId: modCase.userId,
            metadata: {
                caseId: modCase.id,
                caseNumber: modCase.caseNumber,
                action: modCase.action,
            },
            dedupeKey: `mod-case-expired-failed:${modCase.id}`,
            dedupeWindowSeconds: 1800,
        });
    }
}

export async function processModerationExpirationsOnce(): Promise<void> {
    const now = new Date();
    const expiringCases = await db.select()
        .from(moderationCase)
        .where(and(
            eq(moderationCase.active, true),
            inArray(moderationCase.action, [...EXPIRABLE_ACTIONS]),
            lte(moderationCase.expiresAt, now)
        ))
        .limit(MAX_CASES_PER_RUN);

    if (expiringCases.length === 0) {
        return;
    }

    logger.info(`Processing ${expiringCases.length} expired moderation case(s).`);

    const moduleEnabledCache = new Map<string, boolean>();

    for (const modCase of expiringCases) {
        let moderationEnabled = moduleEnabledCache.get(modCase.guildId);
        if (moderationEnabled === undefined) {
            moderationEnabled = await isModuleEnabled(modCase.guildId, 'moderation');
            moduleEnabledCache.set(modCase.guildId, moderationEnabled);
        }

        if (!moderationEnabled) {
            continue;
        }

        await processExpiredCase(modCase);
    }
}

export function setupModerationExpirationsJob(): void {
    cron.schedule("* * * * *", async () => {
        if (isRunning) {
            return;
        }

        isRunning = true;
        try {
            await processModerationExpirationsOnce();
        } catch (error) {
            logger.error("Moderation expiration job failed:", error);
        } finally {
            isRunning = false;
        }
    });
}
