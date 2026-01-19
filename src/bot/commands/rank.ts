import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { db } from '../../shared/database/client';
import { levelProfile, guildConfig } from '../../shared/database/schema';
import { eq, and } from 'drizzle-orm';
import { calculateLevel, xpForLevel } from '../utils/leveling';
import { Command } from '../types/Command';

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

        try {
            // Check if leveling enabled
            const config = await db.query.guildConfig.findFirst({
                where: eq(guildConfig.guildId, guildId)
            });

            if (!config?.levelingEnabled) {
                return interaction.reply({ content: 'Leveling is currently disabled in this server.', ephemeral: true });
            }

            const profile = await db.query.levelProfile.findFirst({
                where: and(
                    eq(levelProfile.guildId, guildId),
                    eq(levelProfile.userId, targetUser.id)
                )
            });

            if (!profile) {
                return interaction.reply({
                    content: targetUser.id === interaction.user.id
                        ? "You haven't earned any XP yet! Start chatting to level up."
                        : `${targetUser.username} hasn't earned any XP yet.`,
                    ephemeral: true
                });
            }

            const currentLevel = profile.level;
            const currentXp = profile.totalXp;
            const nextLevelXp = xpForLevel(currentLevel + 1);
            const prevLevelXp = xpForLevel(currentLevel);

            const progress = currentXp - prevLevelXp;
            const required = nextLevelXp - prevLevelXp;
            const percentage = Math.floor((progress / required) * 100);

            const embed = new EmbedBuilder()
                .setTitle(`${targetUser.username}'s Rank`)
                .setThumbnail(targetUser.displayAvatarURL())
                .setColor('#5865F2')
                .addFields(
                    { name: 'Level', value: currentLevel.toString(), inline: true },
                    { name: 'Total XP', value: currentXp.toLocaleString(), inline: true },
                    { name: 'Progress', value: `${percentage}% (${progress.toLocaleString()} / ${required.toLocaleString()} XP to Level ${currentLevel + 1})` }
                )
                .setFooter({ text: `Voice Minutes: ${profile.totalVoiceMinutes}` });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error fetching rank:', error);
            await interaction.reply({ content: 'There was an error fetching the rank.', ephemeral: true });
        }
    }
};
