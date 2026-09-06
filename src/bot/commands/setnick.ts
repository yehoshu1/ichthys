import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types/Command';
import logger from '../utils/logger';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('setnick')
        .setDescription('Change a user\'s nickname')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to change nickname for')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('nickname')
                .setDescription('The new nickname (leave empty to remove)')
                .setRequired(false)
                .setMaxLength(32)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const targetUser = interaction.options.getUser('user', true);
        const newNickname = interaction.options.getString('nickname') || null;

        const member = interaction.guild.members.cache.get(targetUser.id);
        if (!member) {
            await interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });
            return;
        }

        // Check if we can manage this user
        if (!member.manageable) {
            await interaction.reply({ 
                content: '❌ I cannot change this user\'s nickname. They may have higher permissions than me.', 
                ephemeral: true 
            });
            return;
        }

        // Check if the command user can manage this user
        const commandMember = interaction.guild.members.cache.get(interaction.user.id);
        if (commandMember && member.roles.highest.position >= commandMember.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
            await interaction.reply({ 
                content: '❌ You cannot change the nickname of a user with equal or higher role than you.', 
                ephemeral: true 
            });
            return;
        }

        await interaction.deferReply();

        try {
            const oldNickname = member.nickname || member.user.username;
            await member.setNickname(newNickname);

            if (newNickname) {
                await interaction.editReply(`✅ Changed **${targetUser.tag}**'s nickname from "${oldNickname}" to "${newNickname}".`);
                logger.info(`${interaction.user.tag} changed ${targetUser.tag}'s nickname to "${newNickname}" in ${interaction.guild.name}`);
            } else {
                await interaction.editReply(`✅ Reset **${targetUser.tag}**'s nickname (was "${oldNickname}").`);
                logger.info(`${interaction.user.tag} reset ${targetUser.tag}'s nickname in ${interaction.guild.name}`);
            }
        } catch (error) {
            logger.error('Error setting nickname:', error);
            await interaction.editReply('❌ Failed to change nickname. Please check my permissions.');
        }
    }
};

export default command;
