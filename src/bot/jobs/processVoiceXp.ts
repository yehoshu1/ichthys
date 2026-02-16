import cron from 'node-cron';
import { GuildMember } from 'discord.js';
import { and, asc, eq, gt, inArray, isNotNull } from 'drizzle-orm';
import client from '../client';
import logger from '../utils/logger';
import { db } from '../../shared/database/client';
import { levelProfile, guildConfig, type GuildConfig } from '../../shared/database/schema';
import { processVoiceXpForMember } from '../services/voiceXpService';
import { isModuleEnabled } from '@shared/modules/state';

const CHUNK_SIZE = 100;
const VOICE_XP_CRON = '*/5 * * * *';
const DELAY_BETWEEN_CHUNKS_MS = 10; // Small delay to prevent event loop blocking

interface VoiceXpRunStats {
    processedProfiles: number;
    awardedProfiles: number;
    staleFinalized: number;
    skippedNoElapsed: number;
    skippedDisabled: number;
    skippedUnavailable: number;
    casConflicts: number;
    errors: number;
    totalMinutesProcessed: number;
    totalXpAwarded: number;
    totalLevelUps: number;
    dbQueries: number; // Track DB query count for monitoring
}

interface ActiveVoiceProfile {
    id: string;
    guildId: string;
    userId: string;
}

let isRunning = false;

function getHumanMemberCountInVoice(member: GuildMember): number {
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) return 0;

    let count = 0;
    for (const channelMember of voiceChannel.members.values()) {
        if (!channelMember.user.bot) count += 1;
    }
    return count;
}

/**
 * 🎯 PERFORMANCE FIX: Batch fetch all guild configs at once
 * This replaces the N+1 query pattern where we fetched config for each profile
 */
async function getGuildConfigsBatch(guildIds: string[]): Promise<Map<string, GuildConfig>> {
    if (guildIds.length === 0) return new Map();

    const uniqueGuildIds = [...new Set(guildIds)];

    const configs = await db
        .select()
        .from(guildConfig)
        .where(inArray(guildConfig.guildId, uniqueGuildIds));

    return new Map(configs.map(c => [c.guildId, c]));
}



export async function processVoiceXpOnce(): Promise<void> {
    const startTime = Date.now();
    const stats: VoiceXpRunStats = {
        processedProfiles: 0,
        awardedProfiles: 0,
        staleFinalized: 0,
        skippedNoElapsed: 0,
        skippedDisabled: 0,
        skippedUnavailable: 0,
        casConflicts: 0,
        errors: 0,
        totalMinutesProcessed: 0,
        totalXpAwarded: 0,
        totalLevelUps: 0,
        dbQueries: 0
    };

    let cursorId: string | null = null;
    let hasMore = true;
    let chunksProcessed = 0;
    const moduleEnabledCache = new Map<string, boolean>();

    while (hasMore) {
        chunksProcessed++;

        // Fetch chunk of active profiles
        const activeProfiles: ActiveVoiceProfile[] = cursorId
            ? await db.select({
                id: levelProfile.id,
                guildId: levelProfile.guildId,
                userId: levelProfile.userId
            })
                .from(levelProfile)
                .where(and(
                    isNotNull(levelProfile.voiceJoinedAt),
                    gt(levelProfile.id, cursorId)
                ))
                .orderBy(asc(levelProfile.id))
                .limit(CHUNK_SIZE)
            : await db.select({
                id: levelProfile.id,
                guildId: levelProfile.guildId,
                userId: levelProfile.userId
            })
                .from(levelProfile)
                .where(isNotNull(levelProfile.voiceJoinedAt))
                .orderBy(asc(levelProfile.id))
                .limit(CHUNK_SIZE);

        if (activeProfiles.length === 0) {
            hasMore = false;
            break;
        }

        cursorId = activeProfiles[activeProfiles.length - 1].id;

        // 🎯 PERFORMANCE FIX: Batch fetch ALL guild configs for this chunk in ONE query
        const uniqueGuildIds = [...new Set(activeProfiles.map(p => p.guildId))];
        const guildConfigMap = await getGuildConfigsBatch(uniqueGuildIds);
        stats.dbQueries += 1; // Track this query

        const now = new Date();

        // Process profiles using cached configs
        for (const activeProfile of activeProfiles) {
            stats.processedProfiles += 1;

            try {
                // 🎯 Use batch-fetched config instead of individual query
                const config = guildConfigMap.get(activeProfile.guildId) ?? null;

                let levelingModuleEnabled = moduleEnabledCache.get(activeProfile.guildId);
                if (levelingModuleEnabled === undefined) {
                    levelingModuleEnabled = await isModuleEnabled(activeProfile.guildId, 'leveling');
                    moduleEnabledCache.set(activeProfile.guildId, levelingModuleEnabled);
                }

                if (!levelingModuleEnabled) {
                    stats.skippedDisabled += 1;
                    continue;
                }

                if (!config?.levelingEnabled) {
                    stats.skippedDisabled += 1;

                    const guild = client.guilds.cache.get(activeProfile.guildId)
                        ?? await client.guilds.fetch(activeProfile.guildId).catch((error) => { logger.warn(`Failed to fetch guild ${activeProfile.guildId} for voice XP processing:`, error); return null; });
                    const member = guild
                        ? guild.members.cache.get(activeProfile.userId)
                        ?? await guild.members.fetch(activeProfile.userId).catch((error) => { logger.warn(`Failed to fetch member ${activeProfile.userId} for voice XP processing:`, error); return null; })
                        : null;

                    const nextAnchor = member && !member.user.bot && member.voice.channelId ? now : null;
                    await db.update(levelProfile)
                        .set({
                            voiceJoinedAt: nextAnchor,
                            updatedAt: now
                        })
                        .where(and(
                            eq(levelProfile.guildId, activeProfile.guildId),
                            eq(levelProfile.userId, activeProfile.userId)
                        ));

                    continue;
                }

                const guild = client.guilds.cache.get(activeProfile.guildId)
                    ?? await client.guilds.fetch(activeProfile.guildId).catch((error) => { logger.warn(`Failed to fetch guild ${activeProfile.guildId} for voice XP processing:`, error); return null; });

                if (!guild) {
                    stats.skippedUnavailable += 1;
                    continue;
                }

                const member = guild.members.cache.get(activeProfile.userId)
                    ?? await guild.members.fetch(activeProfile.userId).catch((error) => { logger.warn(`Failed to fetch member ${activeProfile.userId} for voice XP processing:`, error); return null; });

                if (!member || member.user.bot) {
                    stats.skippedUnavailable += 1;
                    continue;
                }

                if (!member.voice.channelId) {
                    const result = await processVoiceXpForMember({
                        member,
                        config,
                        eligibleForXp: false,
                        finalizeSession: true,
                        now
                    });

                    if (result.status === 'processed') {
                        stats.staleFinalized += 1;
                    } else if (result.status === 'cas_conflict') {
                        stats.casConflicts += 1;
                    } else if (result.status === 'no_elapsed') {
                        stats.skippedNoElapsed += 1;
                    }
                    continue;
                }

                const isEligibleForXp = getHumanMemberCountInVoice(member) >= 2;
                const result = await processVoiceXpForMember({
                    member,
                    config,
                    eligibleForXp: isEligibleForXp,
                    now
                });

                if (result.status === 'processed') {
                    stats.totalMinutesProcessed += result.minutesProcessed;
                    stats.totalXpAwarded += result.xpEarned;
                    stats.totalLevelUps += result.levelUps;

                    if (result.xpEarned > 0) {
                        stats.awardedProfiles += 1;
                    }
                    if (result.minutesProcessed === 0) {
                        stats.skippedNoElapsed += 1;
                    }
                } else if (result.status === 'no_elapsed') {
                    stats.skippedNoElapsed += 1;
                } else if (result.status === 'cas_conflict') {
                    stats.casConflicts += 1;
                }
            } catch (error) {
                stats.errors += 1;
                logger.error(`Failed processing voice XP for ${activeProfile.guildId}/${activeProfile.userId}:`, error);
            }
        }

        // 🎯 PERFORMANCE FIX: Add small delay between chunks to prevent event loop blocking
        if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS_MS));
        }
    }

    const durationMs = Date.now() - startTime;

    logger.info(
        `Voice XP run complete: ` +
        `profiles=${stats.processedProfiles}, ` +
        `awarded=${stats.awardedProfiles}, ` +
        `minutes=${stats.totalMinutesProcessed}, ` +
        `xp=${stats.totalXpAwarded}, ` +
        `levelUps=${stats.totalLevelUps}, ` +
        `staleFinalized=${stats.staleFinalized}, ` +
        `noElapsed=${stats.skippedNoElapsed}, ` +
        `disabled=${stats.skippedDisabled}, ` +
        `unavailable=${stats.skippedUnavailable}, ` +
        `casConflicts=${stats.casConflicts}, ` +
        `errors=${stats.errors}, ` +
        `dbQueries=${stats.dbQueries}, ` + // Track query count
        `chunks=${chunksProcessed}, ` +
        `durationMs=${durationMs}`
    );
}

export function setupVoiceXpProcessingJob(): void {
    cron.schedule(VOICE_XP_CRON, async () => {
        if (isRunning) {
            logger.warn('Skipping voice XP job because previous run is still active.');
            return;
        }

        isRunning = true;
        try {
            await processVoiceXpOnce();
        } catch (error) {
            logger.error('Voice XP job failed:', error);
        } finally {
            isRunning = false;
        }
    });

    logger.info('Voice XP processing job scheduled (every 5 minutes).');
}
