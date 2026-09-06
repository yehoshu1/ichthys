import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../types/Command';
import { db } from '../../shared/database/client';
import { moderationCase, levelProfile } from '../../shared/database/schema';
import { eq, and, sql } from 'drizzle-orm';
import logger from '../utils/logger';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('user')
        .setDescription('Display detailed information about a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to get information about')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guildId!;

        await interaction.deferReply();

        try {
            const member = interaction.guild?.members.cache.get(targetUser.id);
            
            // Get warning count
            const warningResult = await db
                .select({ count: sql<number>`count(*)` })
                .from(moderationCase)
                .where(and(
                    eq(moderationCase.guildId, guildId),
                    eq(moderationCase.userId, targetUser.id),
                    eq(moderationCase.action, 'WARN'),
                    eq(moderationCase.active, true)
                ));
            const warningCount = warningResult[0]?.count || 0;

            // Get level profile if exists
            const profile = await db.query.levelProfile.findFirst({
                where: and(
                    eq(levelProfile.guildId, guildId),
                    eq(levelProfile.userId, targetUser.id)
                )
            });

            const embed = new EmbedBuilder()
                .setTitle(`${targetUser.username}'s Information`)
                .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
                .setColor(member?.displayHexColor || '#5865F2')
                .addFields(
                    { name: '👤 Username', value: targetUser.tag, inline: true },
                    { name: '🆔 User ID', value: targetUser.id, inline: true },
                    { name: '🤖 Bot', value: targetUser.bot ? 'Yes' : 'No', inline: true },
                    { name: '📅 Account Created', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>`, inline: false }
                );

            if (member) {
                // Member-specific information
                const roles = member.roles.cache
                    .filter(r => r.id !== interaction.guildId) // Filter out @everyone
                    .sort((a, b) => b.position - a.position)
                    .map(r => r.toString())
                    .slice(0, 10) // Limit to first 10 roles
                    .join(', ') || 'None';

                const roleCount = member.roles.cache.size - 1; // Exclude @everyone

                embed.addFields(
                    { name: '🎭 Nickname', value: member.nickname || 'None', inline: true },
                    { name: '🌟 Boosting Since', value: member.premiumSince ? `<t:${Math.floor(member.premiumSinceTimestamp! / 1000)}:R>` : 'Not boosting', inline: true },
                    { name: '⏰ Joined Server', value: `<t:${Math.floor(member.joinedTimestamp! / 1000)}:F>`, inline: false },
                    { name: `🎨 Roles (${roleCount})`, value: roles.length > 100 ? roles.substring(0, 100) + '...' : roles, inline: false }
                );

                // Key permissions
                const keyPermissions: (`Administrator` | `ManageGuild` | `ManageMessages` | `ManageRoles` | `ManageChannels` | `KickMembers` | `BanMembers` | `ManageNicknames`)[] = [
                    'Administrator', 'ManageGuild', 'ManageMessages', 'ManageRoles',
                    'ManageChannels', 'KickMembers', 'BanMembers', 'ManageNicknames'
                ];
                const hasPermissions = keyPermissions.filter(perm => member.permissions.has(perm));
                if (hasPermissions.length > 0) {
                    embed.addFields({
                        name: '🔑 Key Permissions',
                        value: hasPermissions.map(p => p.replace(/([A-Z])/g, ' $1').trim()).join(', '),
                        inline: false
                    });
                }
            }

            // Add leveling info if available
            if (profile) {
                embed.addFields({
                    name: '📊 Leveling Stats',
                    value: `Level: ${profile.level} | XP: ${profile.totalXp.toLocaleString()}`,
                    inline: false
                });
            }

            // Add warning count
            if (warningCount > 0) {
                embed.addFields({
                    name: '⚠️ Active Warnings',
                    value: `${warningCount}`,
                    inline: true
                });
            }

            embed.setFooter({ text: `Requested by ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Error fetching user info:', error);
            await interaction.editReply({ content: 'There was an error fetching user information.' });
        }
    }
};

export default command;
