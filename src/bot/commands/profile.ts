import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { db } from '../../shared/database/client';
import { levelProfile, guildConfig } from '../../shared/database/schema';
import { eq, and, or, gt, gte, lt, sql } from 'drizzle-orm';
import { xpForLevel } from '../utils/leveling';
import { Command } from '../types/Command';
import logger from '../utils/logger';

// This is an alias for /rank command
const command: Command = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View your or another user\'s profile card with level and XP')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to view the profile of')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guildId!;

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

            const member = interaction.guild?.members.cache.get(targetUser.id);

            const embed = new EmbedBuilder()
                .setTitle(`${targetUser.username}'s Profile`)
                .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
                .setColor(member?.displayHexColor || '#5865F2')
                .addFields(
                    {
                        name: '🏆 Rank',
                        value: rank
                            ? `#${rank.toLocaleString()} of ${rankedMemberCount.toLocaleString()} ranked members`
                            : `Unranked (requires Level 1 / ${levelOneXp.toLocaleString()} XP)`,
                        inline: false
                    },
                    { name: '⭐ Level', value: currentLevel.toString(), inline: true },
                    { name: '💎 Total XP', value: currentXp.toLocaleString(), inline: true },
                    { name: '⬆️ Progress', value: `${percentage}% (${progress.toLocaleString()} / ${required.toLocaleString()} XP to Level ${currentLevel + 1})`, inline: false },
                    { name: '💬 Text XP', value: profile.textXp.toLocaleString(), inline: true },
                    { name: '🔊 Voice XP', value: profile.voiceXp.toLocaleString(), inline: true },
                    { name: '⏱️ Voice Time', value: `${Math.floor(profile.totalVoiceMinutes / 60)}h ${profile.totalVoiceMinutes % 60}m`, inline: true }
                )
                .setFooter({ text: `User ID: ${targetUser.id}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Error fetching profile:', error);
            await interaction.editReply({ content: 'There was an error fetching the profile.' });
        }
        return;
    }
};

export default command;
