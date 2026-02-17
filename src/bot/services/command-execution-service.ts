import type {
    ChatInputCommandInteraction,
    Message,
} from 'discord.js';
import { GuildMember } from 'discord.js';
import logger from '../utils/logger';
import { commandConfigService } from './commandConfigService';
import { commandReplyCleanupService } from './commandReplyCleanupService';
import { isModuleEnabled } from '@shared/modules/state';
import { resolveModuleForCommand } from '@shared/modules/registry';
import type { Command } from '../types/Command';
import {
    clearCommandPolicyContext,
    evaluateCommandPolicy,
    setCommandPolicyContext,
} from './command-policy-service';

function getMemberRoleIds(member: ChatInputCommandInteraction['member']): string[] {
    if (!member) return [];
    if (member instanceof GuildMember) {
        return Array.from(member.roles.cache.keys());
    }

    const roles = (member as { roles?: string[] | { cache?: Map<string, unknown> } }).roles;
    if (Array.isArray(roles)) {
        return roles;
    }

    if (roles && 'cache' in roles && roles.cache instanceof Map) {
        return Array.from(roles.cache.keys());
    }

    return [];
}

async function sendCommandDeniedReply(
    interaction: ChatInputCommandInteraction,
    message: string
): Promise<void> {
    const payload = { content: message, ephemeral: true };
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: payload.content }).catch(() => undefined);
        return;
    }

    await interaction.reply(payload).catch(() => undefined);
}

async function sendCommandErrorReply(interaction: ChatInputCommandInteraction): Promise<void> {
    const payload = {
        content: 'There was an error executing this command!',
        ephemeral: true,
    };

    if (interaction.deferred || interaction.replied) {
        try {
            await interaction.editReply({ content: payload.content });
            return;
        } catch (editError) {
            logger.warn('Failed to edit command error reply, attempting fallback reply:', editError);
        }
    }

    try {
        await interaction.reply(payload);
        return;
    } catch (replyError) {
        logger.warn('Failed to send command error reply, attempting follow-up:', replyError);
    }

    await interaction.followUp(payload).catch((followUpError) => {
        logger.warn('Failed to send command error follow-up:', followUpError);
    });
}

function getRequestedLimit(interaction: ChatInputCommandInteraction, optionName: string): number | null {
    const integerValue = interaction.options.getInteger(optionName, false);
    if (integerValue !== null) return integerValue;

    const numericValue = interaction.options.getNumber(optionName, false);
    if (numericValue !== null) return numericValue;

    const stringValue = interaction.options.getString(optionName, false);
    if (!stringValue) return null;

    const parsed = Number.parseFloat(stringValue);
    return Number.isFinite(parsed) ? parsed : null;
}

function denialReasonToMessage(reason: 'base' | 'channel' | 'role' | undefined): string {
    switch (reason) {
        case 'base':
            return 'You do not have permission to use this command.';
        case 'channel':
            return 'This command is disabled in this channel.';
        case 'role':
            return 'Your role cannot use this command.';
        default:
            return 'This command is not currently available.';
    }
}

async function applyPostExecutionPolicies(
    interaction: ChatInputCommandInteraction,
    commandId: string
): Promise<void> {
    if (!interaction.guildId) return;

    const config = await commandConfigService.getCommandConfig(interaction.guildId, commandId);
    if (!config) return;

    if (!config.autoDeleteReplyAfterSeconds || config.autoDeleteReplyAfterSeconds <= 0) {
        return;
    }

    try {
        const reply = await interaction.fetchReply();
        if (reply && 'delete' in reply) {
            commandReplyCleanupService.scheduleDelete(reply as Message, config.autoDeleteReplyAfterSeconds);
        }
    } catch (error) {
        logger.debug(`Failed to schedule auto-delete for command ${commandId}:`, error);
    }
}

export async function executeCommandInteraction(
    interaction: ChatInputCommandInteraction
): Promise<void> {
    const command = (interaction.client as { commands?: Map<string, Command> }).commands?.get(interaction.commandName);
    if (!command) return;

    try {
        if (interaction.guildId) {
            const moduleId = command.moduleId ?? resolveModuleForCommand(interaction.commandName);
            const moduleEnabled = await isModuleEnabled(interaction.guildId, moduleId);
            if (!moduleEnabled) {
                await sendCommandDeniedReply(
                    interaction,
                    `The **${moduleId.replace(/_/g, ' ')}** module is disabled in this server.`
                );
                return;
            }

            const userRoleIds = getMemberRoleIds(interaction.member);
            const commandExecution = await commandConfigService.evaluateCommandExecution(
                interaction.commandName,
                interaction.guildId,
                interaction.channelId,
                interaction.user.id,
                userRoleIds
            );

            if (!commandExecution.allowed) {
                await sendCommandDeniedReply(interaction, denialReasonToMessage(commandExecution.reason));
                return;
            }

            if (command.limitOptionName) {
                const requestedAmount = getRequestedLimit(interaction, command.limitOptionName);
                const limitCheck = await commandConfigService.checkCommandLimit(
                    interaction.commandName,
                    interaction.guildId,
                    requestedAmount,
                    userRoleIds
                );

                if (!limitCheck.allowed) {
                    await sendCommandDeniedReply(
                        interaction,
                        `Requested value exceeds the maximum limit (${limitCheck.maxLimit}).`
                    );
                    return;
                }
            }
        }

        if (command.policy) {
            const policyResult = await evaluateCommandPolicy(interaction, command.policy);
            if (!policyResult.allowed) {
                await sendCommandDeniedReply(interaction, policyResult.message);
                return;
            }

            setCommandPolicyContext(interaction, policyResult.context);
        }

        await command.execute(interaction);
        await applyPostExecutionPolicies(interaction, interaction.commandName);
    } catch (error) {
        logger.error(`Error executing command ${interaction.commandName}:`, error);
        await sendCommandErrorReply(interaction);
    } finally {
        clearCommandPolicyContext(interaction);
    }
}
