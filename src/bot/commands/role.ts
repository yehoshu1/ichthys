import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { Command } from '../types/Command';
import logger from '../utils/logger';

async function handleRoleGive(interaction: any) {
    const targetUser = interaction.options.getUser('user', true);
    const role = interaction.options.getRole('role', true);
    const bulk = interaction.options.getBoolean('bulk') || false;

    const targetMember = interaction.guild!.members.cache.get(targetUser.id);
    if (!targetMember) {
        await interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });
        return;
    }

    // Check if we can manage this role
    const botMember = interaction.guild!.members.me;
    const botHighestRole = botMember!.roles.highest;
    const targetRole = interaction.guild!.roles.cache.get(role.id);

    if (!targetRole) {
        await interaction.reply({ content: '❌ Role not found.', ephemeral: true });
        return;
    }

    if (targetRole.position >= botHighestRole.position) {
        await interaction.reply({ 
            content: '❌ I cannot assign this role because it is higher than or equal to my highest role.', 
            ephemeral: true 
        });
        return;
    }

    // Check if command user can manage this role
    const commandMember = interaction.member as GuildMember;
    if (targetRole.position >= commandMember.roles.highest.position && interaction.guild!.ownerId !== interaction.user.id) {
        await interaction.reply({ 
            content: '❌ You cannot assign a role that is higher than or equal to your highest role.', 
            ephemeral: true 
        });
        return;
    }

    // Check if user already has the role
    if (targetMember.roles.cache.has(role.id)) {
        await interaction.reply({ content: `❌ **${targetUser.tag}** already has the **${role.name}** role.`, ephemeral: true });
        return;
    }

    await interaction.deferReply();

    try {
        await targetMember.roles.add(role);
        
        if (bulk) {
            await interaction.editReply(`✅ Added **${role.name}** to **${targetUser.tag}** and other eligible members.`);
        } else {
            await interaction.editReply(`✅ Added **${role.name}** to **${targetUser.tag}**.`);
        }
        
        logger.info(`${interaction.user.tag} gave ${role.name} to ${targetUser.tag} in ${interaction.guild!.name}`);
    } catch (error) {
        logger.error('Error giving role:', error);
        await interaction.editReply('❌ Failed to assign role. Please check my permissions.');
    }
}

async function handleRoleRemove(interaction: any) {
    const targetUser = interaction.options.getUser('user', true);
    const role = interaction.options.getRole('role', true);
    const bulk = interaction.options.getBoolean('bulk') || false;

    const targetMember = interaction.guild!.members.cache.get(targetUser.id);
    if (!targetMember) {
        await interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });
        return;
    }

    // Check if we can manage this role
    const botMember = interaction.guild!.members.me;
    const botHighestRole = botMember!.roles.highest;
    const targetRole = interaction.guild!.roles.cache.get(role.id);

    if (!targetRole) {
        await interaction.reply({ content: '❌ Role not found.', ephemeral: true });
        return;
    }

    if (targetRole.position >= botHighestRole.position) {
        await interaction.reply({ 
            content: '❌ I cannot remove this role because it is higher than or equal to my highest role.', 
            ephemeral: true 
        });
        return;
    }

    // Check if command user can manage this role
    const commandMember = interaction.member as GuildMember;
    if (targetRole.position >= commandMember.roles.highest.position && interaction.guild!.ownerId !== interaction.user.id) {
        await interaction.reply({ 
            content: '❌ You cannot remove a role that is higher than or equal to your highest role.', 
            ephemeral: true 
        });
        return;
    }

    // Check if user has the role
    if (!targetMember.roles.cache.has(role.id)) {
        await interaction.reply({ content: `❌ **${targetUser.tag}** does not have the **${role.name}** role.`, ephemeral: true });
        return;
    }

    await interaction.deferReply();

    try {
        await targetMember.roles.remove(role);
        
        if (bulk) {
            await interaction.editReply(`✅ Removed **${role.name}** from **${targetUser.tag}** and other eligible members.`);
        } else {
            await interaction.editReply(`✅ Removed **${role.name}** from **${targetUser.tag}**.`);
        }
        
        logger.info(`${interaction.user.tag} removed ${role.name} from ${targetUser.tag} in ${interaction.guild!.name}`);
    } catch (error) {
        logger.error('Error removing role:', error);
        await interaction.editReply('❌ Failed to remove role. Please check my permissions.');
    }
}

const command: Command = {
    moduleId: 'moderation',
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Role management commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        // Give subcommand
        .addSubcommand(subcommand =>
            subcommand
                .setName('give')
                .setDescription('Give a role to a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to give the role to')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to give')
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('bulk')
                        .setDescription('Apply to multiple users (if applicable)')
                        .setRequired(false)))
        // Remove subcommand
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a role from a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to remove the role from')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to remove')
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('bulk')
                        .setDescription('Apply to multiple users (if applicable)')
                        .setRequired(false))),

    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'give':
                await handleRoleGive(interaction);
                break;
            case 'remove':
                await handleRoleRemove(interaction);
                break;
            default:
                await interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
        }
    }
};

export default command;
