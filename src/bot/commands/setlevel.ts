import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { Command } from '../types/Command';
import { db } from '../../shared/database/client';
import { levelProfile, guildConfig } from '../../shared/database/schema';
import { eq, and } from 'drizzle-orm';
import { xpForLevel, checkAndAssignLevelRewards } from '../utils/leveling';
import logger from '../utils/logger';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('setlevel')
        .setDescription('Set a user\'s level (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to set level for')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of level to set (affects XP distribution)')
                .setRequired(true)
                .addChoices(
                    { name: 'Total Level', value: 'total' },
                    { name: 'Text Level', value: 'text' },
                    { name: 'Voice Level', value: 'voice' }
                ))
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('The new level (must be >= 0)')
                .setRequired(true)
                .setMinValue(0)),

    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const targetUser = interaction.options.getUser('user', true);
        const levelType = interaction.options.getString('type', true);
        const newLevel = interaction.options.getInteger('level', true);
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
            const targetXp = xpForLevel(newLevel);
            
            let newTotalXp = targetXp;
            let newTextXp = profile?.textXp || 0;
            let newVoiceXp = profile?.voiceXp || 0;

            switch (levelType) {
                case 'total':
                    newTotalXp = targetXp;
                    // Keep existing text/voice ratio if profile exists
                    if (profile && profile.totalXp > 0) {
                        const textRatio = profile.textXp / profile.totalXp;
                        const voiceRatio = profile.voiceXp / profile.totalXp;
                        newTextXp = Math.round(targetXp * textRatio);
                        newVoiceXp = Math.round(targetXp * voiceRatio);
                    } else {
                        newTextXp = targetXp;
                        newVoiceXp = 0;
                    }
                    break;
                case 'text':
                    newTextXp = targetXp;
                    // Keep voice XP the same
                    newVoiceXp = profile?.voiceXp || 0;
                    newTotalXp = newTextXp + newVoiceXp;
                    break;
                case 'voice':
                    newVoiceXp = targetXp;
                    // Keep text XP the same
                    newTextXp = profile?.textXp || 0;
                    newTotalXp = newTextXp + newVoiceXp;
                    break;
            }

            if (profile) {
                await db.update(levelProfile)
                    .set({
                        totalXp: newTotalXp,
                        textXp: newTextXp,
                        voiceXp: newVoiceXp,
                        level: newTotalXp >= xpForLevel(newLevel + 1) ? newLevel + 1 : newLevel,
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
                    level: newTotalXp >= xpForLevel(newLevel + 1) ? newLevel + 1 : newLevel
                });
            }

            // Check and assign level rewards if level increased
            const member = interaction.guild.members.cache.get(targetUser.id);
            if (member && newLevel > oldLevel) {
                await checkAndAssignLevelRewards(member, newLevel);
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ Level Updated')
                .setColor(0x00FF00)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Level Type', value: levelType === 'total' ? 'Total Level' : levelType === 'text' ? 'Text Level' : 'Voice Level', inline: true },
                    { name: 'New Level', value: newLevel.toString(), inline: true },
                    { name: 'Old Level', value: oldLevel.toString(), inline: true },
                    { name: 'New Total XP', value: newTotalXp.toLocaleString(), inline: true },
                    { name: 'Level Change', value: newLevel > oldLevel ? `⬆️ +${newLevel - oldLevel}` : newLevel < oldLevel ? `⬇️ ${newLevel - oldLevel}` : '➡️ No change', inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            logger.info(`Admin ${interaction.user.tag} set ${levelType} level for ${targetUser.tag} to ${newLevel} in guild ${interaction.guild.name}`);

        } catch (error) {
            logger.error('Error setting level:', error);
            await interaction.editReply({ content: '❌ Failed to update level. Please try again later.' });
        }
    }
};

export default command;
