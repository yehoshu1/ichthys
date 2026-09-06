import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../types/Command';
import logger from '../utils/logger';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('roles')
        .setDescription('List all server roles or view role details')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('View details for a specific role')
                .setRequired(false)),

    async execute(interaction) {
        const guild = interaction.guild;
        const specificRole = interaction.options.getRole('role');

        if (!guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        await interaction.deferReply();

        try {
            if (specificRole) {
                // Show specific role details
                const role = guild.roles.cache.get(specificRole.id);
                if (!role) {
                    await interaction.editReply({ content: '❌ Role not found.' });
                    return;
                }

                const membersWithRole = guild.members.cache.filter(m => m.roles.cache.has(role.id));
                const memberCount = membersWithRole.size;

                // Format permissions
                const permissions = role.permissions.toArray()
                    .map(p => p.replace(/_/g, ' ').toLowerCase())
                    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
                    .sort();

                const embed = new EmbedBuilder()
                    .setTitle(`🎨 Role: ${role.name}`)
                    .setColor(role.color || '#99AAB5')
                    .addFields(
                        { name: '🆔 Role ID', value: role.id, inline: true },
                        { name: '🎨 Color', value: role.hexColor, inline: true },
                        { name: '👥 Members', value: memberCount.toString(), inline: true },
                        { name: '📊 Position', value: `${role.position} / ${guild.roles.cache.size - 1}`, inline: true },
                        { name: '🔒 Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
                        { name: '🔰 Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true }
                    );

                if (role.icon) {
                    embed.setThumbnail(role.iconURL()!);
                }

                if (permissions.length > 0) {
                    const permissionChunks = [];
                    let currentChunk = '';
                    
                    for (const perm of permissions) {
                        if ((currentChunk + perm + ', ').length > 1024) {
                            permissionChunks.push(currentChunk.slice(0, -2));
                            currentChunk = perm + ', ';
                        } else {
                            currentChunk += perm + ', ';
                        }
                    }
                    if (currentChunk) {
                        permissionChunks.push(currentChunk.slice(0, -2));
                    }

                    embed.addFields({
                        name: `🔑 Permissions (${permissions.length})`,
                        value: permissionChunks[0].substring(0, 1024),
                        inline: false
                    });

                    // Add additional permission fields if needed
                    for (let i = 1; i < permissionChunks.length && i < 2; i++) {
                        embed.addFields({
                            name: `🔑 Permissions (continued)`,
                            value: permissionChunks[i].substring(0, 1024),
                            inline: false
                        });
                    }
                }

                embed.setFooter({ text: `Created: ${role.createdAt?.toLocaleDateString() || 'Unknown'}` });

                await interaction.editReply({ embeds: [embed] });
            } else {
                // List all roles
                const roles = guild.roles.cache
                    .filter(r => r.id !== guild.id) // Filter @everyone
                    .sort((a, b) => b.position - a.position);

                if (roles.size === 0) {
                    await interaction.editReply({ content: 'No custom roles found in this server.' });
                    return;
                }

                // Paginate if too many roles
                const roleList = roles.map(r => {
                    const memberCount = guild.members.cache.filter(m => m.roles.cache.has(r.id)).size;
                    return `<@&${r.id}> - ${memberCount} members`;
                });

                // Split into chunks if needed
                const chunks = [];
                let currentChunk = '';
                
                for (const role of roleList) {
                    if ((currentChunk + role + '\n').length > 4000) {
                        chunks.push(currentChunk);
                        currentChunk = role + '\n';
                    } else {
                        currentChunk += role + '\n';
                    }
                }
                if (currentChunk) {
                    chunks.push(currentChunk);
                }

                const embed = new EmbedBuilder()
                    .setTitle(`🎨 ${guild.name} Roles (${roles.size})`)
                    .setColor('#5865F2')
                    .setDescription(chunks[0].substring(0, 4096))
                    .setFooter({ text: `Use /roles <role> for detailed information` });

                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            logger.error('Error fetching roles:', error);
            await interaction.editReply({ content: 'There was an error fetching role information.' });
        }
    }
};

export default command;
