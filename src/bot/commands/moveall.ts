import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, GuildMember, VoiceChannel, StageChannel } from 'discord.js';
import { Command } from '../types/Command';
import logger from '../utils/logger';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('moveall')
        .setDescription('Move all users from one voice channel to another')
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
        .addChannelOption(option =>
            option.setName('from')
                .setDescription('The voice channel to move users from')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice))
        .addChannelOption(option =>
            option.setName('to')
                .setDescription('The voice channel to move users to')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)),

    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const sourceChannel = interaction.options.getChannel('from', true) as VoiceChannel | StageChannel;
        const targetChannel = interaction.options.getChannel('to', true) as VoiceChannel | StageChannel;

        // Validate channels are different
        if (sourceChannel.id === targetChannel.id) {
            await interaction.reply({ content: '❌ Source and target channels must be different.', ephemeral: true });
            return;
        }

        // Check bot permissions in target channel
        const botMember = interaction.guild.members.me;
        const targetPerms = targetChannel.permissionsFor(botMember!);
        if (!targetPerms?.has('Connect') || !targetPerms?.has('MoveMembers')) {
            await interaction.reply({ 
                content: '❌ I don\'t have permission to move members to the target channel.', 
                ephemeral: true 
            });
            return;
        }

        // Check bot permissions in source channel
        const sourcePerms = sourceChannel.permissionsFor(botMember!);
        if (!sourcePerms?.has('MoveMembers')) {
            await interaction.reply({ 
                content: '❌ I don\'t have permission to move members from the source channel.', 
                ephemeral: true 
            });
            return;
        }

        // Get members in source channel
        const membersToMove = sourceChannel.members.filter(member => 
            !member.user.bot && member.voice.channelId === sourceChannel.id
        );

        if (membersToMove.size === 0) {
            await interaction.reply({ 
                content: `❌ No users found in **${sourceChannel.name}**.`, 
                ephemeral: true 
            });
            return;
        }

        // Check command user's permission to move these members
        const commandMember = interaction.member as GuildMember;
        const membersAboveRole = membersToMove.filter(member => 
            member.roles.highest.position >= commandMember.roles.highest.position && 
            interaction.guild!.ownerId !== interaction.user.id
        );

        if (membersAboveRole.size > 0) {
            await interaction.reply({ 
                content: `❌ You cannot move ${membersAboveRole.size} user(s) with equal or higher role than you.`, 
                ephemeral: true 
            });
            return;
        }

        // Check user limit on target channel
        if (targetChannel.userLimit > 0) {
            const availableSlots = targetChannel.userLimit - targetChannel.members.size;
            if (availableSlots < membersToMove.size && !targetPerms?.has('Administrator')) {
                await interaction.reply({ 
                    content: `❌ Target channel only has ${availableSlots} slot(s) available, but ${membersToMove.size} user(s) need to be moved.`, 
                    ephemeral: true 
                });
                return;
            }
        }

        await interaction.deferReply();

        let movedCount = 0;
        let failedCount = 0;
        const failedUsers: string[] = [];

        // Move members one by one
        for (const [, member] of membersToMove) {
            try {
                await member.voice.setChannel(targetChannel);
                movedCount++;
            } catch (error) {
                failedCount++;
                failedUsers.push(member.user.tag);
                logger.warn(`Failed to move ${member.user.tag}:`, error);
            }
        }

        // Build response message
        let response = `✅ **Move Complete**\n\n`;
        response += `📊 **${movedCount}** user(s) moved from **${sourceChannel.name}** to **${targetChannel.name}**`;

        if (failedCount > 0) {
            response += `\n\n⚠️ **${failedCount}** user(s) failed to move:`;
            if (failedUsers.length <= 5) {
                response += `\n${failedUsers.map(u => `• ${u}`).join('\n')}`;
            } else {
                response += `\n${failedUsers.slice(0, 5).map(u => `• ${u}`).join('\n')}\n• ... and ${failedUsers.length - 5} more`;
            }
        }

        await interaction.editReply(response);

        logger.info(
            `${interaction.user.tag} moved ${movedCount} users from ${sourceChannel.name} to ${targetChannel.name} ` +
            `(failed: ${failedCount}) in ${interaction.guild.name}`
        );
    }
};

export default command;
