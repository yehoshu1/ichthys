import { SlashCommandBuilder, ChannelType, GuildMember } from 'discord.js';
import { Command } from '../types/Command';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('moveme')
        .setDescription('Move yourself to a voice channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The voice channel to move to')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Move to the same channel as this user')
                .setRequired(false)),

    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const member = interaction.member as GuildMember;
        const targetChannel = interaction.options.getChannel('channel');
        const targetUser = interaction.options.getUser('user');

        // Check if user is in a voice channel
        if (!member.voice.channel) {
            await interaction.reply({ content: '❌ You must be in a voice channel to use this command.', ephemeral: true });
            return;
        }

        // Determine target channel
        let destinationChannel = targetChannel;

        if (targetUser) {
            const targetMember = interaction.guild.members.cache.get(targetUser.id);
            if (!targetMember?.voice.channel) {
                await interaction.reply({ content: `❌ **${targetUser.tag}** is not in a voice channel.`, ephemeral: true });
                return;
            }
            destinationChannel = targetMember.voice.channel;
        }

        if (!destinationChannel) {
            await interaction.reply({ content: '❌ Please specify either a channel or a user to move to.', ephemeral: true });
            return;
        }

        // Check if user is already in the target channel
        if (member.voice.channelId === destinationChannel.id) {
            await interaction.reply({ content: '❌ You are already in that channel.', ephemeral: true });
            return;
        }

        // Check permissions
        const voiceChannel = interaction.guild.channels.cache.get(destinationChannel.id);
        if (!voiceChannel?.isVoiceBased()) {
            await interaction.reply({ content: '❌ Invalid voice channel.', ephemeral: true });
            return;
        }

        const permissions = voiceChannel.permissionsFor(interaction.guild.members.me!);
        if (!permissions?.has('Connect') || !permissions?.has('MoveMembers')) {
            await interaction.reply({ content: '❌ I don\'t have permission to move members to that channel.', ephemeral: true });
            return;
        }

        // Check user limit
        if (voiceChannel.userLimit > 0 && voiceChannel.members.size >= voiceChannel.userLimit) {
            // Check if bot has permission to bypass user limit
            if (!permissions?.has('Administrator')) {
                await interaction.reply({ content: '❌ That channel is full.', ephemeral: true });
                return;
            }
        }

        try {
            await member.voice.setChannel(voiceChannel);
            await interaction.reply({ content: `✅ Moved you to **${voiceChannel.name}**.`, ephemeral: true });
        } catch (error) {
            await interaction.reply({ content: '❌ Failed to move you. Please check my permissions.', ephemeral: true });
        }
    }
};

export default command;
