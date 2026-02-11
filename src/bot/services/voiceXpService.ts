import { GuildMember } from 'discord.js';
import { and, eq } from 'drizzle-orm';
import { db } from '../../shared/database/client';
import { guildConfig, levelProfile, type GuildConfig } from '../../shared/database/schema';
import { calculateLevel, checkAndAssignLevelRewards } from '../utils/leveling';
import { buildMessage } from '../utils/embeds';
import logger from '../utils/logger';

export interface ProcessVoiceXpOptions {
    member: GuildMember;
    config: GuildConfig;
    eligibleForXp: boolean;
    finalizeSession?: boolean;
    now?: Date;
}

export interface ProcessVoiceXpResult {
    status: 'processed' | 'no_profile' | 'no_anchor' | 'no_elapsed' | 'cas_conflict';
    minutesProcessed: number;
    xpEarned: number;
    levelUps: number;
}

function addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + (minutes * 60_000));
}

async function sendVoiceLevelUpNotification(
    member: GuildMember,
    config: GuildConfig,
    newLevel: number,
    newTotalXp: number
): Promise<void> {
    if (!config.levelUpNotifEnabled || !config.levelUpChannelId) {
        return;
    }

    const channel = member.guild.channels.cache.get(config.levelUpChannelId)
        ?? await member.guild.channels.fetch(config.levelUpChannelId).catch((error) => { logger.warn(`Failed to fetch level up channel ${config.levelUpChannelId}:`, error); return null; });

    if (!channel || !channel.isTextBased()) {
        return;
    }

    const variables = {
        user: member.toString(),
        level: newLevel.toString(),
        xp: newTotalXp.toString()
    };

    let content = config.levelUpMessage;
    const embedConfig = config.levelUpMessageEmbed as any;
    const isEmbedEnabled = embedConfig?.enabled || (embedConfig && (embedConfig.title || embedConfig.description));

    if (!content && !isEmbedEnabled) {
        content = '🎉 **Level Up!** {user} has reached level **{level}** via voice activity!';
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

export async function processVoiceXpForMember(options: ProcessVoiceXpOptions): Promise<ProcessVoiceXpResult> {
    const { member, config, eligibleForXp, finalizeSession = false } = options;
    const now = options.now ?? new Date();

    const profile = await db.query.levelProfile.findFirst({
        where: and(
            eq(levelProfile.guildId, member.guild.id),
            eq(levelProfile.userId, member.id)
        )
    });

    if (!profile) {
        return {
            status: 'no_profile',
            minutesProcessed: 0,
            xpEarned: 0,
            levelUps: 0
        };
    }

    const previousVoiceJoinedAt = profile.voiceJoinedAt;
    if (!previousVoiceJoinedAt) {
        return {
            status: 'no_anchor',
            minutesProcessed: 0,
            xpEarned: 0,
            levelUps: 0
        };
    }

    const elapsedMinutes = Math.floor((now.getTime() - previousVoiceJoinedAt.getTime()) / 60_000);

    if (elapsedMinutes <= 0) {
        if (!finalizeSession) {
            return {
                status: 'no_elapsed',
                minutesProcessed: 0,
                xpEarned: 0,
                levelUps: 0
            };
        }

        const clearedRows = await db.update(levelProfile)
            .set({
                voiceJoinedAt: null,
                updatedAt: now
            })
            .where(and(
                eq(levelProfile.id, profile.id),
                eq(levelProfile.voiceJoinedAt, previousVoiceJoinedAt)
            ))
            .returning({ id: levelProfile.id });

        if (clearedRows.length === 0) {
            return {
                status: 'cas_conflict',
                minutesProcessed: 0,
                xpEarned: 0,
                levelUps: 0
            };
        }

        return {
            status: 'processed',
            minutesProcessed: 0,
            xpEarned: 0,
            levelUps: 0
        };
    }

    const minutesProcessed = elapsedMinutes;
    const xpEarned = eligibleForXp ? minutesProcessed * config.voiceXpPerMinute : 0;

    const newTotalXp = profile.totalXp + xpEarned;
    const newVoiceXp = profile.voiceXp + xpEarned;
    const newTotalVoiceMinutes = profile.totalVoiceMinutes + minutesProcessed;
    const newLevel = calculateLevel(newTotalXp);
    const newVoiceJoinedAt = finalizeSession ? null : addMinutes(previousVoiceJoinedAt, minutesProcessed);

    const updatedRows = await db.update(levelProfile)
        .set({
            totalXp: newTotalXp,
            voiceXp: newVoiceXp,
            totalVoiceMinutes: newTotalVoiceMinutes,
            level: newLevel,
            voiceJoinedAt: newVoiceJoinedAt,
            updatedAt: now
        })
        .where(and(
            eq(levelProfile.id, profile.id),
            eq(levelProfile.voiceJoinedAt, previousVoiceJoinedAt)
        ))
        .returning({ id: levelProfile.id });

    if (updatedRows.length === 0) {
        return {
            status: 'cas_conflict',
            minutesProcessed: 0,
            xpEarned: 0,
            levelUps: 0
        };
    }

    const levelUps = Math.max(0, newLevel - profile.level);
    if (levelUps > 0) {
        try {
            await checkAndAssignLevelRewards(member, newLevel);
            await sendVoiceLevelUpNotification(member, config, newLevel, newTotalXp);
        } catch (error) {
            logger.error(`Failed handling voice level-up side effects for ${member.user.tag}:`, error);
        }
    }

    return {
        status: 'processed',
        minutesProcessed,
        xpEarned,
        levelUps
    };
}

export async function getGuildLevelingConfig(guildId: string): Promise<GuildConfig | null> {
    const config = await db.query.guildConfig.findFirst({
        where: eq(guildConfig.guildId, guildId)
    });

    return config ?? null;
}
