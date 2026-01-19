import { Events, Interaction } from 'discord.js';
import { Command } from '../types/Command';

export default {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction) {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands?.get(interaction.commandName);

        if (!command) {
            console.error(`❌ No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await (command as Command).execute(interaction);
            console.log(`✅ Command executed: ${interaction.commandName} by ${interaction.user.tag}`);
        } catch (error) {
            console.error(`❌ Error executing ${interaction.commandName}:`, error);

            const errorMessage = {
                content: 'There was an error executing this command!',
                ephemeral: true
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    },
};
