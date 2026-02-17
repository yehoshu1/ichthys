import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { db } from '../../shared/database/client';
import { levelProfile, guildConfig } from '../../shared/database/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import { Command } from '../types/Command';
import logger from '../utils/logger';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('top')
        .setDescription('View the server leaderboard with time-based filtering')
        .addStringOption(option =>
            option.setName('period')
                .setDescription('Time period for the leaderboard')
                .setRequired(false)
                .addChoices(
                    { name: 'All Time', value: 'all' },
                    { name: 'Today', value: 'day' },
                    { name: 'This Week', value: 'week' },
                    { name: 'This Month', value: 'month' }
                )),

    async execute(interaction) {
        const guildId = interaction.guildId!;
        const period = interaction.options.getString('period') || 'all';

        await interaction.deferReply();

        try {
            // Check if leveling enabled
            const config = await db.query.guildConfig.findFirst({
                where: eq(guildConfig.guildId, guildId)
            });

            if (!config?.levelingEnabled) {
                await interaction.editReply({ content: 'Leveling is currently disabled in this server.' });
                return;
            }

            let timeFilter: Date | null = null;
            let periodLabel = 'All Time';

            const now = new Date();

            switch (period) {
                case 'day':
                    timeFilter = new Date(now.setDate(now.getDate() - 1));
                    periodLabel = 'Today';
                    break;
                case 'week':
                    timeFilter = new Date(now.setDate(now.getDate() - 7));
                    periodLabel = 'This Week';
                    break;
                case 'month':
                    timeFilter = new Date(now.setMonth(now.getMonth() - 1));
                    periodLabel = 'This Month';
                    break;
            }

            // Note: Since we track total XP cumulatively, time-based filtering for XP 
            // would require a separate XP history table. For now, we show all-time
            // data with a note about the limitation.
            
            let query = db.select({
                userId: levelProfile.userId,
                level: levelProfile.level,
                totalXp: levelProfile.totalXp,
                textXp: levelProfile.textXp,
                voiceXp: levelProfile.voiceXp,
                totalVoiceMinutes: levelProfile.totalVoiceMinutes,
                updatedAt: levelProfile.updatedAt
            })
                .from(levelProfile)
                .where(eq(levelProfile.guildId, guildId))
                .orderBy(desc(levelProfile.totalXp))
                .limit(10);

            // If time filter is applied, we filter by last activity
            // This is a simplified approach - users active in the period
            if (timeFilter) {
                query = db.select({
                    userId: levelProfile.userId,
                    level: levelProfile.level,
                    totalXp: levelProfile.totalXp,
                    textXp: levelProfile.textXp,
                    voiceXp: levelProfile.voiceXp,
                    totalVoiceMinutes: levelProfile.totalVoiceMinutes,
                    updatedAt: levelProfile.updatedAt
                })
                    .from(levelProfile)
                    .where(and(
                        eq(levelProfile.guildId, guildId),
                        gte(levelProfile.updatedAt, timeFilter)
                    ))
                    .orderBy(desc(levelProfile.totalXp))
                    .limit(10);
            }

            const topUsers = await query;

            if (topUsers.length === 0) {
                await interaction.editReply({ content: `No active users found for ${periodLabel}.` });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(`🏆 ${interaction.guild?.name} Leaderboard (${periodLabel})`)
                .setColor('#FAA61A')
                .setDescription(
                    topUsers.map((u, i) => {
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;
                        return `${medal} <@${u.userId}> • Level ${u.level} • ${u.totalXp.toLocaleString()} XP`;
                    }).join('\n')
                );

            if (period !== 'all') {
                embed.setFooter({ text: 'Note: Shows users active during this period. XP gains are cumulative.' });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Error fetching leaderboard:', error);
            await interaction.editReply({ content: 'There was an error fetching the leaderboard.' });
        }
    }
};

export default command;
