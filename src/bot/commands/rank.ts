import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { db } from '../../shared/database/client';
import { levelProfile, guildConfig } from '../../shared/database/schema';
import { eq, and, or, gt, gte, lt, sql } from 'drizzle-orm';
import { xpForLevel } from '../utils/leveling';
import { Command } from '../types/Command';
import logger from '../utils/logger';

export const rank: Command = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Check your current level and XP')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check the rank of')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guildId!;

        // Defer reply for database operations
        await interaction.deferReply();

        try {
            // Check if leveling enabled
            const config = await db.query.guildConfig.findFirst({
                where: eq(guildConfig.guildId, guildId)
            });

            if (!config?.levelingEnabled) {
                return interaction.editReply({ content: 'Leveling is currently disabled in this server.' });
            }

            const profile = await db.query.levelProfile.findFirst({
                where: and(
                    eq(levelProfile.guildId, guildId),
                    eq(levelProfile.userId, targetUser.id)
                )
            });

            if (!profile) {
                const levelOneXp = xpForLevel(1);
                return interaction.editReply({
                    content: targetUser.id === interaction.user.id
                        ? `You haven't earned any XP yet! Reach ${levelOneXp.toLocaleString()} XP to get ranked.`
                        : `${targetUser.username} hasn't earned any XP yet and is not ranked yet.`
                });
            }

            const currentLevel = profile.level;
            const currentXp = profile.totalXp;
            const levelOneXp = xpForLevel(1);
            const nextLevelXp = xpForLevel(currentLevel + 1);
            const prevLevelXp = xpForLevel(currentLevel);
            const isRankEligible = currentXp >= levelOneXp;

            let rank: number | null = null;
            let rankedMemberCount = 0;

            if (isRankEligible) {
                const [totalRankedResult, higherRankedResult] = await Promise.all([
                    db.select({ count: sql<number>`count(*)` })
                        .from(levelProfile)
                        .where(and(
                            eq(levelProfile.guildId, guildId),
                            gte(levelProfile.totalXp, levelOneXp)
                        )),
                    db.select({ count: sql<number>`count(*)` })
                        .from(levelProfile)
                        .where(and(
                            eq(levelProfile.guildId, guildId),
                            gte(levelProfile.totalXp, levelOneXp),
                            or(
                                gt(levelProfile.totalXp, currentXp),
                                and(
                                    eq(levelProfile.totalXp, currentXp),
                                    lt(levelProfile.userId, targetUser.id)
                                )
                            )
                        ))
                ]);

                rankedMemberCount = Number(totalRankedResult[0]?.count ?? 0);
                rank = Number(higherRankedResult[0]?.count ?? 0) + 1;
            }

            const progress = currentXp - prevLevelXp;
            const required = nextLevelXp - prevLevelXp;
            const percentage = Math.floor((progress / required) * 100);

            const embed = new EmbedBuilder()
                .setTitle(`${targetUser.username}'s Rank`)
                .setThumbnail(targetUser.displayAvatarURL())
                .setColor('#5865F2')
                .addFields(
                    {
                        name: 'Rank',
                        value: rank
                            ? `#${rank.toLocaleString()} of ${rankedMemberCount.toLocaleString()} ranked members`
                            : `Unranked (requires Level 1 / ${levelOneXp.toLocaleString()} XP)`,
                        inline: false
                    },
                    { name: 'Level', value: currentLevel.toString(), inline: true },
                    { name: 'Total XP', value: currentXp.toLocaleString(), inline: true },
                    { name: 'Progress', value: `${percentage}% (${progress.toLocaleString()} / ${required.toLocaleString()} XP to Level ${currentLevel + 1})` }
                )
                .setFooter({ text: `Voice Minutes: ${profile.totalVoiceMinutes}` });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Error fetching rank:', error);
            await interaction.editReply({ content: 'There was an error fetching the rank.' });
        }
        return;
    }
};
