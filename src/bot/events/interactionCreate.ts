import {
    ChatInputCommandInteraction,
    Events,
    Interaction,
    Message,
    PermissionFlagsBits,
} from 'discord.js';
import type { Event } from '../types/Event';
import client from '../client';
import logger from '../utils/logger';
import { guildConfigService } from '../services/guildConfigService';
import { buildSetupPanel, type SetupPage } from '../utils/setupPanel';
import { checkRateLimit, formatRateLimitMessage } from '../utils/rateLimiter';
import { commandConfigService, type ResolvedCommandConfig } from '../services/commandConfigService';
import { commandReplyCleanupService } from '../services/commandReplyCleanupService';

function getRoleIds(interaction: ChatInputCommandInteraction): string[] {
    const member = interaction.member;
    if (!member) return [];

    if ('roles' in member) {
        const roles = member.roles;
        if (Array.isArray(roles)) {
            return roles;
        }

        if ('cache' in roles) {
            return roles.cache.map((role) => role.id);
        }
    }

    return [];
}

function extractRequestedLimit(interaction: ChatInputCommandInteraction): number | null {
    const preferredOptionNames = ['amount', 'limit'];
    for (const optionName of preferredOptionNames) {
        const integerValue = interaction.options.getInteger(optionName, false);
        if (integerValue !== null) {
            return integerValue;
        }

        const numberValue = interaction.options.getNumber(optionName, false);
        if (numberValue !== null) {
            return numberValue;
        }
    }

    return null;
}

function isMessageLike(value: unknown): value is Message {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as { id?: unknown; delete?: unknown; channelId?: unknown };
    return typeof candidate.id === 'string'
        && typeof candidate.delete === 'function'
        && typeof candidate.channelId === 'string';
}

function hasAutoDeleteEnabled(config: ResolvedCommandConfig | null): config is ResolvedCommandConfig {
    if (!config) return false;
    return config.autoDeleteInvocation
        || config.autoDeleteWithInvocationDeletion
        || (config.autoDeleteReplyAfterSeconds !== null && config.autoDeleteReplyAfterSeconds > 0);
}

function setupAutoDeleteTracking(
    interaction: ChatInputCommandInteraction,
    config: ResolvedCommandConfig | null
): void {
    if (!hasAutoDeleteEnabled(config)) return;

    let invocationMessageId: string | null = null;

    const trackReply = async (result: unknown, source: 'reply' | 'editReply' | 'followUp'): Promise<void> => {
        let message: Message | null = null;

        if (isMessageLike(result)) {
            message = result;
        } else if (source !== 'followUp' && (interaction.replied || interaction.deferred)) {
            message = await interaction.fetchReply().catch(() => null);
        }

        if (!message) return;

        if (!invocationMessageId) {
            invocationMessageId = message.id;
            if (config.autoDeleteInvocation) {
                await commandReplyCleanupService.deleteMessageSafe(message);
            }
        } else if (config.autoDeleteWithInvocationDeletion && invocationMessageId !== message.id) {
            commandReplyCleanupService.linkReplyToInvocation(invocationMessageId, message);
        }

        if (config.autoDeleteReplyAfterSeconds && config.autoDeleteReplyAfterSeconds > 0) {
            commandReplyCleanupService.scheduleDelete(message, config.autoDeleteReplyAfterSeconds);
        }
    };

    const originalReply: any = interaction.reply.bind(interaction);
    const originalEditReply: any = interaction.editReply.bind(interaction);
    const originalFollowUp: any = interaction.followUp.bind(interaction);

    interaction.reply = (async (...args: any[]) => {
        if (typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
            args[0] = { ...args[0], fetchReply: true };
        } else if (typeof args[0] === 'string') {
            args[0] = { content: args[0], fetchReply: true };
        }
        const result = await originalReply(...args);
        await trackReply(result, 'reply');
        return result;
    }) as typeof interaction.reply;

    interaction.editReply = (async (...args: any[]) => {
        const result = await originalEditReply(...args);
        await trackReply(result, 'editReply');
        return result;
    }) as typeof interaction.editReply;

    interaction.followUp = (async (...args: any[]) => {
        if (typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
            args[0] = { ...args[0], fetchReply: true };
        } else if (typeof args[0] === 'string') {
            args[0] = { content: args[0], fetchReply: true };
        }
        const result = await originalFollowUp(...args);
        await trackReply(result, 'followUp');
        return result;
    }) as typeof interaction.followUp;
}

const event: Event<Events.InteractionCreate> = {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction) {
        if (interaction.isChatInputCommand()) {
            const commandId = interaction.commandName;
            const command = client.commands?.get(commandId);

            if (!command) {
                logger.warn(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            const guildId = interaction.guildId;
            const channelId = interaction.channelId;
            const userId = interaction.user.id;
            const userRoleIds = getRoleIds(interaction);

            if (guildId) {
                const permissionResult = await commandConfigService.evaluateCommandExecution(
                    commandId,
                    guildId,
                    channelId,
                    userId,
                    userRoleIds
                );

                if (!permissionResult.allowed) {
                    let message = 'You cannot use this command due to server command restrictions.';
                    if (permissionResult.reason === 'base') {
                        message = 'You do not have permission to use this command.';
                    } else if (permissionResult.reason === 'channel') {
                        message = 'This command is not enabled in this channel.';
                    } else if (permissionResult.reason === 'role') {
                        message = 'Your roles are not allowed to use this command.';
                    }

                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: message, ephemeral: true });
                    } else {
                        await interaction.reply({ content: message, ephemeral: true });
                    }
                    return;
                }

                const requestedLimit = extractRequestedLimit(interaction);
                const limitResult = await commandConfigService.checkCommandLimit(
                    commandId,
                    guildId,
                    requestedLimit,
                    userRoleIds
                );

                if (!limitResult.allowed) {
                    const message = `This command cannot exceed **${limitResult.maxLimit}** for your roles.`;
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: message, ephemeral: true });
                    } else {
                        await interaction.reply({ content: message, ephemeral: true });
                    }
                    return;
                }

                setupAutoDeleteTracking(interaction, permissionResult.config);
            }

            // Check rate limit
            const rateLimitResult = checkRateLimit(userId, guildId, commandId);

            if (!rateLimitResult.allowed) {
                const message = formatRateLimitMessage(rateLimitResult);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: message, ephemeral: true });
                } else {
                    await interaction.reply({ content: message, ephemeral: true });
                }
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error: any) {
                logger.error(`Error executing ${commandId}:`, error);

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
    }
};

export default event;
