import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { Command } from '../types/Command';
import logger from '../utils/logger';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set slowmode for the current channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(option =>
            option.setName('time')
                .setDescription('Slowmode duration (e.g., 5s, 10m, 1h, or 0 to disable)')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('seconds')
                .setDescription('Slowmode duration in seconds (0 to disable, max 21600)')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(21600)),

    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const channel = interaction.channel;
        if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
            await interaction.reply({ content: '❌ This command can only be used in text channels.', ephemeral: true });
            return;
        }

        const timeStr = interaction.options.getString('time');
        const secondsInput = interaction.options.getInteger('seconds');

        let seconds = 0;

        if (secondsInput !== null) {
            seconds = secondsInput;
        } else if (timeStr) {
            // Parse time string like "5s", "10m", "1h"
            const match = timeStr.match(/^(\d+)([smh])$/);
            if (!match && timeStr !== '0') {
                await interaction.reply({ 
                    content: '❌ Invalid time format. Use format like: `5s`, `10m`, `1h`, or `0` to disable.', 
                    ephemeral: true 
                });
                return;
            }
            
            if (match) {
                const [, amount, unit] = match;
                const num = parseInt(amount, 10);
                
                switch (unit) {
                    case 's': seconds = num; break;
                    case 'm': seconds = num * 60; break;
                    case 'h': seconds = num * 3600; break;
                }
            }
        }

        // Max slowmode is 6 hours (21600 seconds)
        if (seconds > 21600) {
            await interaction.reply({ content: '❌ Slowmode cannot exceed 6 hours (21600 seconds).', ephemeral: true });
            return;
        }

        await interaction.deferReply();

        try {
            await channel.setRateLimitPerUser(seconds, `Set by ${interaction.user.tag}`);

            if (seconds === 0) {
                await interaction.editReply('✅ Slowmode has been disabled.');
                logger.info(`${interaction.user.tag} disabled slowmode in ${channel.name} in ${interaction.guild.name}`);
            } else {
                let timeDisplay = '';
                if (seconds < 60) {
                    timeDisplay = `${seconds} second${seconds !== 1 ? 's' : ''}`;
                } else if (seconds < 3600) {
                    timeDisplay = `${Math.floor(seconds / 60)} minute${Math.floor(seconds / 60) !== 1 ? 's' : ''}`;
                } else {
                    timeDisplay = `${Math.floor(seconds / 3600)} hour${Math.floor(seconds / 3600) !== 1 ? 's' : ''}`;
                }

                await interaction.editReply(`✅ Slowmode set to **${timeDisplay}**.`);
                logger.info(`${interaction.user.tag} set slowmode to ${seconds}s in ${channel.name} in ${interaction.guild.name}`);
            }

        } catch (error) {
            logger.error('Error setting slowmode:', error);
            await interaction.editReply('❌ Failed to set slowmode. Please check my permissions.');
        }
    }
};

export default command;
