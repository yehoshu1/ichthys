import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { Command } from '../types/Command';
import { db } from '../../shared/database/client';
import { levelProfile, guildConfig } from '../../shared/database/schema';
import { eq, and } from 'drizzle-orm';
import { calculateLevel, checkAndAssignLevelRewards } from '../utils/leveling';
import logger from '../utils/logger';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('setxp')
        .setDescription('Set a user\'s XP (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to set XP for')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of XP to set')
                .setRequired(true)
                .addChoices(
                    { name: 'Total XP', value: 'total' },
                    { name: 'Text XP', value: 'text' },
                    { name: 'Voice XP', value: 'voice' }
                ))
        .addIntegerOption(option =>
            option.setName('xp')
                .setDescription('The new XP value (must be >= 0)')
                .setRequired(true)
                .setMinValue(0)),

    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const targetUser = interaction.options.getUser('user', true);
        const xpType = interaction.options.getString('type', true);
        const newXp = interaction.options.getInteger('xp', true);
        const guildId = interaction.guildId!;

        await interaction.deferReply();

        try {
            // Check if leveling enabled
            const config = await db.query.guildConfig.findFirst({
                where: eq(guildConfig.guildId, guildId)
            });

            if (!config?.levelingEnabled) {
                await interaction.editReply({ content: '❌ Leveling is currently disabled in this server.' });
                return;
            }

            // Get or create profile
            let profile = await db.query.levelProfile.findFirst({
                where: and(
                    eq(levelProfile.guildId, guildId),
                    eq(levelProfile.userId, targetUser.id)
                )
            });

            const oldLevel = profile?.level || 0;
            let newTotalXp = newXp;
            let newTextXp = profile?.textXp || 0;
            let newVoiceXp = profile?.voiceXp || 0;

            switch (xpType) {
                case 'total':
                    newTotalXp = newXp;
                    // Adjust text/voice proportionally if they exist
                    if (profile && profile.totalXp > 0) {
                        const textRatio = profile.textXp / profile.totalXp;
                        const voiceRatio = profile.voiceXp / profile.totalXp;
                        newTextXp = Math.round(newXp * textRatio);
                        newVoiceXp = Math.round(newXp * voiceRatio);
                    } else {
                        // Default to all text XP for new users
                        newTextXp = newXp;
                        newVoiceXp = 0;
                    }
                    break;
                case 'text':
                    newTextXp = newXp;
                    newTotalXp = (profile?.totalXp || 0) - (profile?.textXp || 0) + newXp;
                    break;
                case 'voice':
                    newVoiceXp = newXp;
                    newTotalXp = (profile?.totalXp || 0) - (profile?.voiceXp || 0) + newXp;
                    break;
            }

            const newLevel = calculateLevel(newTotalXp);

            if (profile) {
                await db.update(levelProfile)
                    .set({
                        totalXp: newTotalXp,
                        textXp: newTextXp,
                        voiceXp: newVoiceXp,
                        level: newLevel,
                        updatedAt: new Date()
                    })
                    .where(and(
                        eq(levelProfile.guildId, guildId),
                        eq(levelProfile.userId, targetUser.id)
                    ));
            } else {
                await db.insert(levelProfile).values({
                    guildId,
                    userId: targetUser.id,
                    totalXp: newTotalXp,
                    textXp: newTextXp,
                    voiceXp: newVoiceXp,
                    level: newLevel
                });
            }

            // Check and assign level rewards if level increased
            const member = interaction.guild.members.cache.get(targetUser.id);
            if (member && newLevel > oldLevel) {
                await checkAndAssignLevelRewards(member, newLevel);
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ XP Updated')
                .setColor(0x00FF00)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'XP Type', value: xpType === 'total' ? 'Total XP' : xpType === 'text' ? 'Text XP' : 'Voice XP', inline: true },
                    { name: 'New XP Value', value: newXp.toLocaleString(), inline: true },
                    { name: 'Old Level', value: oldLevel.toString(), inline: true },
                    { name: 'New Level', value: newLevel.toString(), inline: true },
                    { name: 'Level Change', value: newLevel > oldLevel ? `⬆️ +${newLevel - oldLevel}` : newLevel < oldLevel ? `⬇️ ${newLevel - oldLevel}` : '➡️ No change', inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            logger.info(`Admin ${interaction.user.tag} set ${xpType} XP for ${targetUser.tag} to ${newXp} in guild ${interaction.guild.name}`);

        } catch (error) {
            logger.error('Error setting XP:', error);
            await interaction.editReply({ content: '❌ Failed to update XP. Please try again later.' });
        }
    }
};

export default command;
