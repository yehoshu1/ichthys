import { Events, VoiceState, TextChannel } from 'discord.js';
import client from '../client';
import logger from '../utils/logger';
import { db } from '../../shared/database/client';
import { guildConfig, levelProfile } from '../../shared/database/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { calculateLevel, checkAndAssignLevelRewards } from '../utils/leveling';
import { buildMessage } from '../utils/embeds';

export default function setupVoiceStateUpdateHandler() {
    client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
        const guild = newState.guild;
        const member = newState.member;

        if (!member || member.user.bot) return;

        try {
            // Check config
            const config = await db.query.guildConfig.findFirst({
                where: eq(guildConfig.guildId, guild.id)
            });

            if (!config?.levelingEnabled) return;

            // Handle Join (or switch channel)
            if (!oldState.channelId && newState.channelId) {
                // User joined voice
                logger.debug(`${member.user.tag} joined voice channel ${newState.channel?.name} `);

                // Ensure profile exists or create it
                let profile = await db.query.levelProfile.findFirst({
                    where: and(eq(levelProfile.guildId, guild.id), eq(levelProfile.userId, member.id))
                });

                if (!profile) {
                    await db.insert(levelProfile).values({
                        guildId: guild.id,
                        userId: member.id,
                        voiceJoinedAt: new Date()
                    });
                    logger.debug(`Created new profile for ${member.user.tag} with voiceJoinedAt set`);
                } else {
                    await db.update(levelProfile)
                        .set({ voiceJoinedAt: new Date(), updatedAt: new Date() })
                        .where(eq(levelProfile.id, profile.id));
                    logger.debug(`Updated voiceJoinedAt for ${member.user.tag}`);
                }
            }

            // Handle Leave
            else if (oldState.channelId && !newState.channelId) {
                // User left voice
                logger.debug(`${member.user.tag} left voice channel ${oldState.channel?.name} `);

                const profile = await db.query.levelProfile.findFirst({
                    where: and(eq(levelProfile.guildId, guild.id), eq(levelProfile.userId, member.id))
                });

                if (profile && profile.voiceJoinedAt) {
                    const now = new Date();
                    const durationMs = now.getTime() - profile.voiceJoinedAt.getTime();
                    const minutes = Math.floor(durationMs / 60000);

                    logger.debug(`${member.user.tag} was in voice for ${minutes} minutes(${durationMs}ms)`);

                    if (minutes > 0) {
                        const xpEarned = minutes * config.voiceXpPerMinute;

                        const newTotalXp = profile.totalXp + xpEarned;
                        const newVoiceXp = profile.voiceXp + xpEarned;
                        const newTotalMinutes = profile.totalVoiceMinutes + minutes;
                        const newLevel = calculateLevel(newTotalXp);

                        await db.update(levelProfile)
                            .set({
                                totalXp: newTotalXp,
                                voiceXp: newVoiceXp,
                                totalVoiceMinutes: newTotalMinutes,
                                level: newLevel,
                                voiceJoinedAt: null, // Reset join time
                                updatedAt: now
                            })
                            .where(eq(levelProfile.id, profile.id));

                        logger.debug(`Awarded ${xpEarned} Voice XP to ${member.user.tag} for ${minutes} mins`);

                        // Check and assign level rewards
                        if (newLevel > profile.level) {
                            await checkAndAssignLevelRewards(member, newLevel);
                        }

                        // Level Up Notification
                        if (newLevel > profile.level && config.levelUpNotifEnabled) {
                            const channelId = config.levelUpChannelId;
                            // Notification for voice level up usually goes to a configured channel
                            if (channelId) {
                                const channel = guild.channels.cache.get(channelId) as TextChannel;
                                if (channel && channel.isTextBased()) {
                                    const variables = {
                                        'user': member.toString(),
                                        'level': newLevel.toString(),
                                        'xp': newTotalXp.toString()
                                    };

                                    let content = config.levelUpMessage;
                                    const embedConfig = config.levelUpMessageEmbed as any;
                                    const isEmbedEnabled = embedConfig?.enabled || (embedConfig && (embedConfig.title || embedConfig.description));

                                    if (!content && !isEmbedEnabled) {
                                        content = `🎉 **Level Up!** {user} has reached level **{level}** via voice activity!`;
                                    }

                                    const messageData = buildMessage(
                                        content,
                                        config.levelUpMessageEmbed as any,
                                        variables
                                    );

                                    if (messageData) {
                                        await channel.send(messageData);
                                    }
                                }
                            }
                        }
                    } else {
                        // Reset join time even if no minutes (avoid stale state)
                        await db.update(levelProfile)
                            .set({ voiceJoinedAt: null })
                            .where(eq(levelProfile.id, profile.id));
                    }
                }
            }
            // Handle Switch? 
            // Ideally we treat switch as continuous or leave+join.
            // Simplified: if channelId changes but both exist, do nothing? 
            // Or updating timestamp?
            // Current login: only handles distinct Join (null -> id) and Leave (id -> null).
            // Switches (id -> id2) are ignored, so session continues accumulating time.
            // This is acceptable for simple tracking.

        } catch (error) {
            logger.error(`Error processing Voice XP for ${member.user.tag}: `, error);
        }
    });
}
