import { GuildMember } from 'discord.js';
import { db } from '../../shared/database/client';
import { levelReward } from '../../shared/database/schema';
import { eq, and, lte } from 'drizzle-orm';
import logger from '../utils/logger';

export const calculateLevel = (xp: number): number => {
    // Level = 0.1 * sqrt(XP)
    // XP = (Level / 0.1)^2 = (Level * 10)^2 = 100 * Level^2
    return Math.floor(0.1 * Math.sqrt(xp));
};

export const calculateXpForLevel = (level: number): number => {
    return 100 * Math.pow(level, 2);
};
export const xpForLevel = calculateXpForLevel;

export async function checkAndAssignLevelRewards(member: GuildMember, newLevel: number) {
    if (!member.guild) return;

    try {
        // Fetch all rewards for this guild up to the new level
        // We check all <= newLevel to ensure missed roles (e.g. from rapid XP gain) are awarded
        const rewards = await db.select()
            .from(levelReward)
            .where(
                and(
                    eq(levelReward.guildId, member.guild.id),
                    lte(levelReward.level, newLevel)
                )
            );

        if (rewards.length === 0) return;

        for (const reward of rewards) {
            // Check if user already has role
            if (!member.roles.cache.has(reward.roleId)) {
                try {
                    // Check if role exists in guild
                    const role = member.guild.roles.cache.get(reward.roleId);
                    if (role) {
                        await member.roles.add(role);
                        logger.info(`Awarded role ${role.name} to ${member.user.tag} for reaching level ${reward.level}`);

                        // Optional: Send notification? (Usually level up message covers it, or we can append to it)
                    } else {
                        logger.warn(`Role ID ${reward.roleId} not found in guild ${member.guild.name}`);
                    }
                } catch (error) {
                    logger.error(`Failed to assign reward role ${reward.roleId} to ${member.user.tag}:`, error);
                }
            }
        }
    } catch (error) {
        logger.error(`Error checking level rewards for ${member.user.tag}:`, error);
    }
}
