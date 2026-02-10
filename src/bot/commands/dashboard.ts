/**
 * Dashboard Command Module
 * 
 * Provides server members with access to the web dashboard URL.
 * The dashboard URL is configured via the DASHBOARD_URL environment variable.
 * 
 * @module commands/dashboard
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../types/Command';
import logger from '../utils/logger';

// Environment variable for dashboard URL (set by bot deployer/administrator)
const DASHBOARD_URL = process.env.DASHBOARD_URL?.trim() || null;

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('dashboard')
        .setDescription('Show the server dashboard link'),

    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ 
                content: 'This command can only be used in a server.', 
                ephemeral: true 
            });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Check if dashboard URL is configured
            if (!DASHBOARD_URL) {
                await interaction.editReply({ 
                    content: 'Bot URL not set. Please contact an administrator to set up the URL.' 
                });
                logger.warn(`Dashboard URL not configured. User ${interaction.user.tag} requested dashboard link in ${interaction.guild.name}.`);
                return;
            }

            // Dashboard URL is configured
            const guildId = interaction.guildId!;
            const fullUrl = `${DASHBOARD_URL}/dashboard/${guildId}`;

            const embed = new EmbedBuilder()
                .setTitle('🎛️ Server Dashboard')
                .setDescription(`Access your server dashboard to manage settings, view analytics, and configure features.`)
                .setColor('#5865F2')
                .addFields(
                    { 
                        name: '🔗 Dashboard Link', 
                        value: `[Click here to open dashboard](${fullUrl})`, 
                        inline: false 
                    },
                    { 
                        name: '📋 Quick Access', 
                        value: fullUrl, 
                        inline: false 
                    }
                )
                .setFooter({ text: `Server: ${interaction.guild.name}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Error in dashboard command:', error);
            await interaction.editReply({ 
                content: '❌ Failed to retrieve dashboard link. Please try again later.' 
            });
        }
    }
};

export default command;
