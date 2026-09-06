import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../types/Command';
import { guildConfigService } from '../services/guildConfigService';
import { buildSetupPanel } from '../utils/setupPanel';

export const setup: Command = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure Ixoye using an interactive setup panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        // Defer reply for database operation
        await interaction.deferReply({ ephemeral: true });

        try {
            const config = await guildConfigService.getGuildConfig(interaction.guild.id);
            const panel = buildSetupPanel(interaction.guild, config, 'toggles');

            await interaction.editReply(panel);
        } catch (error) {
            await interaction.editReply('An error occurred while loading the setup panel.');
        }
    }
};
