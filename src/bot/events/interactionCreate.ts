import { Events, Interaction } from 'discord.js';
import client from '../client';
import logger from '../utils/logger';

export default function setupInteractionHandler() {
    client.on(Events.InteractionCreate, async (interaction: Interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);

        if (!command) {
            logger.warn(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error: any) {
            logger.error(`Error executing ${interaction.commandName}:`, error);

            // Don't try to reply if the interaction is unknown (timed out)
            if (error.code === 10062) return;

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                }
            } catch (followUpError) {
                logger.error('Failed to send error message to user:', followUpError);
            }
        }
    });
}
