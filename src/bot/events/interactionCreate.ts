import { Events, Interaction } from 'discord.js';
import logger from '../utils/logger';
import { executeCommandInteraction } from '../services/command-execution-service';
import { componentRouter } from '../components/router-instance';

const name = Events.InteractionCreate;

async function execute(interaction: Interaction): Promise<void> {
    try {
        if (interaction.isChatInputCommand()) {
            await executeCommandInteraction(interaction);
            return;
        }

        if (interaction.isButton()) {
            await componentRouter.dispatchButton(interaction);
            return;
        }

        if (interaction.isStringSelectMenu()) {
            await componentRouter.dispatchStringSelect(interaction);
            return;
        }

        if (interaction.isRoleSelectMenu()) {
            await componentRouter.dispatchRoleSelect(interaction);
            return;
        }

        if (interaction.isChannelSelectMenu()) {
            await componentRouter.dispatchChannelSelect(interaction);
            return;
        }

        if (interaction.isModalSubmit()) {
            await componentRouter.dispatchModal(interaction);
        }
    } catch (error) {
        logger.error('Error in interaction handler:', error);
    }
}

export default { name, execute };
