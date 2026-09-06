import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, GuildMember } from 'discord.js';
import { Command } from '../types/Command';
import logger from '../utils/logger';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('move')
        .setDescription('Move a user to a voice channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to move')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The voice channel to move to')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice))
        .addUserOption(option =>
            option.setName('to_user')
                .setDescription('Move to the same channel as this user')
                .setRequired(false)),

    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const targetUser = interaction.options.getUser('user', true);
        const targetChannel = interaction.options.getChannel('channel');
        const toUser = interaction.options.getUser('to_user');

        const member = interaction.guild.members.cache.get(targetUser.id);
        if (!member) {
            await interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });
            return;
        }

        // Check if user is in a voice channel
        if (!member.voice.channel) {
            await interaction.reply({ content: `❌ **${targetUser.tag}** is not in a voice channel.`, ephemeral: true });
            return;
        }

        // Determine destination channel
        let destinationChannel = targetChannel;

        if (toUser) {
            const targetMember = interaction.guild.members.cache.get(toUser.id);
            if (!targetMember?.voice.channel) {
                await interaction.reply({ content: `❌ **${toUser.tag}** is not in a voice channel.`, ephemeral: true });
                return;
            }
            destinationChannel = targetMember.voice.channel;
        }

        if (!destinationChannel) {
            await interaction.reply({ content: '❌ Please specify either a channel or a user to move to.', ephemeral: true });
            return;
        }

        // Check if already in destination
        if (member.voice.channelId === destinationChannel.id) {
            await interaction.reply({ content: `❌ **${targetUser.tag}** is already in that channel.`, ephemeral: true });
            return;
        }

        // Check permissions
        const voiceChannel = interaction.guild.channels.cache.get(destinationChannel.id);
        if (!voiceChannel?.isVoiceBased()) {
            await interaction.reply({ content: '❌ Invalid voice channel.', ephemeral: true });
            return;
        }

        const botMember = interaction.guild.members.me;
        const permissions = voiceChannel.permissionsFor(botMember!);
        if (!permissions?.has('Connect') || !permissions?.has('MoveMembers')) {
            await interaction.reply({ content: '❌ I don\'t have permission to move members to that channel.', ephemeral: true });
            return;
        }

        // Check if command user can move this member
        const commandMember = interaction.member as GuildMember;
        if (member.roles.highest.position >= commandMember.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
            await interaction.reply({ 
                content: '❌ You cannot move a user with equal or higher role than you.', 
                ephemeral: true 
            });
            return;
        }

        // Check user limit
        if (voiceChannel.userLimit > 0 && voiceChannel.members.size >= voiceChannel.userLimit) {
            if (!permissions?.has('Administrator')) {
                await interaction.reply({ content: '❌ That channel is full.', ephemeral: true });
                return;
            }
        }

        await interaction.deferReply();

        try {
            const sourceChannelName = member.voice.channel.name;
            await member.voice.setChannel(voiceChannel);

            await interaction.editReply(`✅ Moved **${targetUser.tag}** from **${sourceChannelName}** to **${voiceChannel.name}**.`);
            logger.info(`${interaction.user.tag} moved ${targetUser.tag} from ${sourceChannelName} to ${voiceChannel.name} in ${interaction.guild.name}`);

        } catch (error) {
            logger.error('Error moving user:', error);
            await interaction.editReply('❌ Failed to move user. Please check my permissions.');
        }
    }
};

export default command;
