import { Events, VoiceState } from 'discord.js';
import type { Event } from '../types/Event';
import logger from '../utils/logger';
import { db } from '../../shared/database/client';
import { guildConfig, levelProfile } from '../../shared/database/schema';
import { and, eq } from 'drizzle-orm';
import { processVoiceXpForMember } from '../services/voiceXpService';

function getHumanCountBeforeTransition(oldState: VoiceState, memberId: string): number {
    const oldChannel = oldState.channel;
    if (!oldChannel) return 0;

    let humanCount = 0;
    for (const channelMember of oldChannel.members.values()) {
        if (!channelMember.user.bot) {
            humanCount += 1;
        }
    }

    // Depending on cache timing, the moving member may already be removed from oldChannel.
    if (!oldChannel.members.has(memberId)) {
        humanCount += 1;
    }

    return humanCount;
}

const event: Event<Events.VoiceStateUpdate> = {
    name: Events.VoiceStateUpdate,
    async execute(oldState: VoiceState, newState: VoiceState) {
        const guild = newState.guild;
        const member = newState.member;

        if (!member || member.user.bot) return;

        try {
            // Check config
            const config = await db.query.guildConfig.findFirst({
                where: eq(guildConfig.guildId, guild.id)
            });
            const isLevelingEnabled = Boolean(config?.levelingEnabled);

            // Handle Join (or switch channel)
            if (!oldState.channelId && newState.channelId) {
                // User joined voice
                logger.debug(`${member.user.tag} joined voice channel ${newState.channel?.name} `);

                const now = new Date();
                await db.insert(levelProfile)
                    .values({
                        guildId: guild.id,
                        userId: member.id,
                        voiceJoinedAt: now
                    })
                    .onConflictDoUpdate({
                        target: [levelProfile.guildId, levelProfile.userId],
                        set: {
                            voiceJoinedAt: now,
                            updatedAt: now
                        }
                    });

                logger.debug(`Set voice session anchor for ${member.user.tag}`);
            }

            // Handle Leave
            else if (oldState.channelId && !newState.channelId) {
                // User left voice
                logger.debug(`${member.user.tag} left voice channel ${oldState.channel?.name} `);

                if (!isLevelingEnabled || !config) {
                    await db.update(levelProfile)
                        .set({ voiceJoinedAt: null, updatedAt: new Date() })
                        .where(and(
                            eq(levelProfile.guildId, guild.id),
                            eq(levelProfile.userId, member.id)
                        ));
                    logger.debug(`Cleared voice session for ${member.user.tag} while leveling disabled`);
                    return;
                }

                const humanCount = getHumanCountBeforeTransition(oldState, member.id);
                const isEligibleForXp = humanCount >= 2;
                const now = new Date();

                let result = await processVoiceXpForMember({
                    member,
                    config,
                    eligibleForXp: isEligibleForXp,
                    finalizeSession: true,
                    now
                });

                // Retry once if a concurrent updater already moved the session anchor.
                if (result.status === 'cas_conflict') {
                    result = await processVoiceXpForMember({
                        member,
                        config,
                        eligibleForXp: isEligibleForXp,
                        finalizeSession: true,
                        now: new Date()
                    });
                }

                logger.debug(
                    `Processed leave XP for ${member.user.tag}: status=${result.status}, `
                    + `minutes=${result.minutesProcessed}, xp=${result.xpEarned}`
                );
            }
            // Handle Switch (channel change)
            else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
                const now = new Date();
                let resultSummary = 'disabled';

                if (isLevelingEnabled && config) {
                    const humanCount = getHumanCountBeforeTransition(oldState, member.id);
                    const isEligibleForXp = humanCount >= 2;

                    const result = await processVoiceXpForMember({
                        member,
                        config,
                        eligibleForXp: isEligibleForXp,
                        finalizeSession: false,
                        now
                    });
                    resultSummary = `status=${result.status}, minutes=${result.minutesProcessed}, xp=${result.xpEarned}`;
                }

                // Reset session anchor on new channel to avoid mixing channel eligibility windows.
                await db.insert(levelProfile)
                    .values({
                        guildId: guild.id,
                        userId: member.id,
                        voiceJoinedAt: now
                    })
                    .onConflictDoUpdate({
                        target: [levelProfile.guildId, levelProfile.userId],
                        set: {
                            voiceJoinedAt: now,
                            updatedAt: now
                        }
                    });

                logger.debug(
                    `${member.user.tag} switched voice channels from ${oldState.channel?.name} `
                    + `to ${newState.channel?.name} (${resultSummary})`
                );
            }

        } catch (error) {
            logger.error(`Error processing Voice XP for ${member.user.tag}: `, error);
        }
    }
};

export default event;
