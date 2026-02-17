import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { db } from '../../shared/database/client';
import { levelProfile, guildConfig } from '../../shared/database/schema';
import { eq, desc } from 'drizzle-orm';
import { Command } from '../types/Command';
import logger from '../utils/logger';

export const leaderboard: Command = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the server XP leaderboard')
        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('The type of leaderboard to view')
                .setRequired(false)
                .addChoices(
                    { name: 'Total XP', value: 'total' },
                    { name: 'Text XP', value: 'text' },
                    { name: 'Voice XP', value: 'voice' }
                )
        ) as any,

    async execute(interaction) {
        const guildId = interaction.guildId!;
        const type = interaction.options.getString('type') || 'total';

        // Defer reply for database operations
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

            let orderBy;
            let typeLabel = "Total XP";

            switch (type) {
                case 'text':
                    orderBy = desc(levelProfile.textXp);
                    typeLabel = "Text XP";
                    break;
                case 'voice':
                    orderBy = desc(levelProfile.voiceXp);
                    typeLabel = "Voice XP";
                    break;
                default:
                    orderBy = desc(levelProfile.totalXp);
                    typeLabel = "Total XP";
            }

            const topUsers = await db.select({
                userId: levelProfile.userId,
                level: levelProfile.level,
                totalXp: levelProfile.totalXp,
                textXp: levelProfile.textXp,
                voiceXp: levelProfile.voiceXp,
                totalVoiceMinutes: levelProfile.totalVoiceMinutes
            })
                .from(levelProfile)
                .where(eq(levelProfile.guildId, guildId))
                .orderBy(orderBy)
                .limit(10);

            if (topUsers.length === 0) {
                await interaction.editReply({ content: 'No one has earned any XP yet!' });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(`🏆 ${interaction.guild?.name} Leaderboard (${typeLabel})`)
                .setColor('#FAA61A')
                .setDescription(
                    topUsers.map((u, i) => {
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;
                        let detail = "";
                        if (type === 'text') detail = `• ${u.textXp.toLocaleString()} Text XP`;
                        else if (type === 'voice') detail = `• ${u.voiceXp.toLocaleString()} Voice XP (${Math.round(u.totalVoiceMinutes / 60)}h)`;
                        else detail = `• ${u.totalXp.toLocaleString()} XP`;

                        return `${medal} <@${u.userId}> • Level ${u.level} ${detail}`;
                    }).join('\n')
                );

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Error fetching leaderboard:', error);
            await interaction.editReply({ content: 'There was an error fetching the leaderboard.' });
        }
    }
};
