import { Events, Interaction, PermissionFlagsBits } from 'discord.js';
import client from '../client';
import logger from '../utils/logger';
import { guildConfigService } from '../services/guildConfigService';
import { buildSetupPanel, type SetupPage } from '../utils/setupPanel';

export default function setupInteractionHandler() {
    client.on(Events.InteractionCreate, async (interaction: Interaction) => {
        if (interaction.isChatInputCommand()) {
            const command = client.commands?.get(interaction.commandName);

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
            return;
        }

        if (
            interaction.isButton()
            || interaction.isRoleSelectMenu()
            || interaction.isChannelSelectMenu()
            || interaction.isStringSelectMenu()
        ) {
            const customId = interaction.customId;
            if (!customId.startsWith('setup:')) return;

            if (!interaction.guildId || !interaction.guild) {
                await interaction.reply({ content: 'This interaction can only be used in a server.', ephemeral: true });
                return;
            }

            const hasPerms = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
            if (!hasPerms) {
                await interaction.reply({ content: 'You need Manage Server permissions to use this setup panel.', ephemeral: true });
                return;
            }

            const [, action, target] = customId.split(':');
            let page: SetupPage = 'toggles';

            try {
                const guildId = interaction.guildId;
                const currentConfig = await guildConfigService.getGuildConfig(guildId);

                if (action === 'toggle') {
                    const updates: any = {};
                    switch (target) {
                        case 'welcome':
                            updates.welcomeEnabled = !currentConfig.welcomeEnabled;
                            break;
                        case 'verification':
                            updates.verificationEnabled = !currentConfig.verificationEnabled;
                            break;
                        case 'boost':
                            updates.boostEnabled = !currentConfig.boostEnabled;
                            break;
                        case 'leveling':
                            updates.levelingEnabled = !currentConfig.levelingEnabled;
                            break;
                        case 'levelup':
                            updates.levelUpNotifEnabled = !currentConfig.levelUpNotifEnabled;
                            break;
                        default:
                            break;
                    }
                    await guildConfigService.updateGuildConfig(guildId, updates);
                    page = 'toggles';
                } else if (action === 'page') {
                    page = target === 'targets' ? 'targets' : 'toggles';
                } else if (action === 'role' && interaction.isRoleSelectMenu()) {
                    const roleId = interaction.values[0];
                    if (target === 'verified') {
                        await guildConfigService.updateGuildConfig(guildId, { verificationRoleId: roleId });
                    } else if (target === 'unverified') {
                        await guildConfigService.updateGuildConfig(guildId, { unverifiedRoleId: roleId });
                    } else if (target === 'boost') {
                        await guildConfigService.updateGuildConfig(guildId, { boostRoleId: roleId });
                    }
                    page = 'targets';
                } else if (action === 'channel' && interaction.isChannelSelectMenu()) {
                    const channelId = interaction.values[0];
                    if (target === 'levelup') {
                        await guildConfigService.updateGuildConfig(guildId, { levelUpChannelId: channelId });
                    }
                    page = 'targets';
                } else if (action === 'clear' && target === 'optional') {
                    await guildConfigService.updateGuildConfig(guildId, {
                        unverifiedRoleId: null,
                        boostRoleId: null,
                        levelUpChannelId: null,
                    });
                    page = 'targets';
                }

                const updatedConfig = await guildConfigService.getGuildConfig(guildId);
                const panel = buildSetupPanel(interaction.guild, updatedConfig, page);
                await interaction.update(panel);
            } catch (error) {
                logger.error('Error handling setup interaction:', error);
                if (!interaction.replied) {
                    await interaction.reply({ content: 'Failed to update settings. Please try again.', ephemeral: true });
                }
            }
        }
    });
}
