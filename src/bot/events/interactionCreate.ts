import { Events, Interaction, GuildMember, PermissionFlagsBits } from 'discord.js';
import type { Event } from '../types/Event';
import logger from '../utils/logger';
import { db } from '../../shared/database/client';
import { reactionRole, reactionRoleMessage } from '../../shared/database/schema';
import { eq, and } from 'drizzle-orm';
import { emitGuildNotificationSafe } from '../services/notificationEmitter';

const event: Event<Events.InteractionCreate> = {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction) {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const { commandName } = interaction;
            const command = interaction.client.commands.get(commandName);

            if (!command) {
                logger.warn(`Command ${commandName} not found`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                logger.error(`Error executing command ${commandName}:`, error);

                const errorMessage = 'There was an error executing this command!';

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: errorMessage, ephemeral: true });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            }
        }

        // 🆕 Handle Button Interactions (for role buttons)
        if (interaction.isButton()) {
            await handleButtonInteraction(interaction);
        }

        // 🆕 Handle Select Menu Interactions (for role dropdowns)
        if (interaction.isStringSelectMenu()) {
            await handleSelectMenuInteraction(interaction);
        }

        // Handle autocomplete
        if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (command?.autocomplete) {
                try {
                    await command.autocomplete(interaction);
                } catch (error) {
                    logger.error(`Error in autocomplete for ${interaction.commandName}:`, error);
                }
            }
        }
    }
};

/**
 * Handle button interactions for role assignment
 */
async function handleButtonInteraction(interaction: any): Promise<void> {
    // Check if this is a role button (format: "role:{roleId}")
    if (!interaction.customId.startsWith('role:')) return;

    const roleId = interaction.customId.replace('role:', '');
    const guildId = interaction.guildId;

    if (!guildId || !interaction.member) return;

    try {
        // Find the role component configuration
        const roleConfig = await db.query.reactionRole.findFirst({
            where: and(
                eq(reactionRole.guildId, guildId),
                eq(reactionRole.roleId, roleId),
                eq(reactionRole.enabled, true)
            )
        });

        if (!roleConfig) {
            await interaction.reply({
                content: 'This role button is no longer active.',
                ephemeral: true
            });
            return;
        }

        const member = interaction.member as GuildMember;
        const role = interaction.guild?.roles.cache.get(roleId);

        if (!role) {
            await interaction.reply({
                content: 'This role no longer exists.',
                ephemeral: true
            });
            return;
        }

        // Check bot permissions
        const botMember = interaction.guild?.members.me;
        if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
            await interaction.reply({
                content: 'I don\'t have permission to manage roles.',
                ephemeral: true
            });
            return;
        }

        // Check if role is manageable
        if (!role.editable) {
            await interaction.reply({
                content: 'I cannot manage this role (it may be higher than my highest role).',
                ephemeral: true
            });
            return;
        }

        // Handle role assignment based on type
        let action: 'added' | 'removed';

        switch (roleConfig.type) {
            case 'ADD_ONLY':
                if (member.roles.cache.has(roleId)) {
                    await interaction.reply({
                        content: `You already have the ${role.name} role.`,
                        ephemeral: true
                    });
                    return;
                }
                await member.roles.add(roleId);
                action = 'added';
                break;

            case 'REMOVE_ONLY':
                if (!member.roles.cache.has(roleId)) {
                    await interaction.reply({
                        content: `You don't have the ${role.name} role.`,
                        ephemeral: true
                    });
                    return;
                }
                await member.roles.remove(roleId);
                action = 'removed';
                break;

            case 'TOGGLE':
            case 'UNIQUE':
            default:
                if (member.roles.cache.has(roleId)) {
                    await member.roles.remove(roleId);
                    action = 'removed';
                } else {
                    await member.roles.add(roleId);
                    action = 'added';

                    // Handle exclusive roles
                    if (roleConfig.exclusiveRoleIds) {
                        for (const exclusiveId of roleConfig.exclusiveRoleIds) {
                            if (member.roles.cache.has(exclusiveId)) {
                                await member.roles.remove(exclusiveId);
                            }
                        }
                    }
                }
                break;
        }

        // Send confirmation
        await interaction.reply({
            content: `✅ You have been ${action} the ${role.name} role.`,
            ephemeral: true
        });

        logger.info(`${member.user.tag} ${action} role ${role.name} via button`);

        await emitGuildNotificationSafe({
            guildId,
            eventType: 'ROLE_BUTTON_USED',
            severity: 'INFO',
            source: 'BOT_EVENT',
            title: `${member.user.tag} ${action} role ${role.name}`,
            targetUserId: member.id,
            metadata: {
                roleId,
                action,
                componentType: 'BUTTON'
            }
        });

    } catch (error) {
        logger.error('Error handling role button:', error);
        await interaction.reply({
            content: 'An error occurred while processing your request.',
            ephemeral: true
        });
    }
}

/**
 * Handle select menu interactions for role dropdowns
 */
async function handleSelectMenuInteraction(interaction: any): Promise<void> {
    // Check if this is a role dropdown (format: "role_dropdown:{messageId}")
    if (!interaction.customId.startsWith('role_dropdown:')) return;

    const messageId = interaction.customId.replace('role_dropdown:', '');
    const guildId = interaction.guildId;

    if (!guildId || !interaction.member) return;

    try {
        const member = interaction.member as GuildMember;
        const selectedRoleIds = interaction.values as string[];

        // Get the message configuration
        const messageConfig = await db.query.reactionRoleMessage.findFirst({
            where: and(
                eq(reactionRoleMessage.guildId, guildId),
                eq(reactionRoleMessage.messageId, messageId)
            )
        });

        if (!messageConfig) {
            await interaction.reply({
                content: 'This role menu is no longer active.',
                ephemeral: true
            });
            return;
        }

        // Get max selections allowed
        const maxSelections = messageConfig.maxSelections || 1;

        if (selectedRoleIds.length > maxSelections) {
            await interaction.reply({
                content: `You can only select up to ${maxSelections} role(s).`,
                ephemeral: true
            });
            return;
        }

        // Get all roles from this dropdown
        const allRoles = await db.query.reactionRole.findMany({
            where: and(
                eq(reactionRole.guildId, guildId),
                eq(reactionRole.messageId, messageId),
                eq(reactionRole.enabled, true)
            )
        });

        const botMember = interaction.guild?.members.me;
        if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
            await interaction.reply({
                content: 'I don\'t have permission to manage roles.',
                ephemeral: true
            });
            return;
        }

        const results: string[] = [];

        // Handle role assignments
        for (const roleConfig of allRoles) {
            const role = interaction.guild?.roles.cache.get(roleConfig.roleId);
            if (!role || !role.editable) continue;

            const isSelected = selectedRoleIds.includes(roleConfig.roleId);
            const hasRole = member.roles.cache.has(roleConfig.roleId);

            if (isSelected && !hasRole) {
                // Add role
                await member.roles.add(roleConfig.roleId);
                results.push(`✅ Added ${role.name}`);
            } else if (!isSelected && hasRole) {
                // Remove role (for toggle behavior)
                if (roleConfig.type === 'TOGGLE' || roleConfig.type === 'UNIQUE') {
                    await member.roles.remove(roleConfig.roleId);
                    results.push(`❌ Removed ${role.name}`);
                }
            }
        }

        // Send summary
        if (results.length > 0) {
            await interaction.reply({
                content: `**Role Updates:**\n${results.join('\n')}`,
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: 'No changes were made to your roles.',
                ephemeral: true
            });
        }

        logger.info(`${member.user.tag} updated roles via dropdown: ${results.join(', ')}`);

        await emitGuildNotificationSafe({
            guildId,
            eventType: 'ROLE_DROPDOWN_USED',
            severity: 'INFO',
            source: 'BOT_EVENT',
            title: `${member.user.tag} updated roles via dropdown`,
            targetUserId: member.id,
            metadata: {
                selectedRoles: selectedRoleIds,
                componentType: 'DROPDOWN'
            }
        });

    } catch (error) {
        logger.error('Error handling role dropdown:', error);
        await interaction.reply({
            content: 'An error occurred while processing your request.',
            ephemeral: true
        });
    }
}

export default event;
