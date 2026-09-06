import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { Command } from '../types/Command';
import logger from '../utils/logger';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Lock a channel to prevent members from sending messages')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to lock (default: current channel)')
                .setRequired(false)
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildVoice,
                    ChannelType.GuildForum,
                    ChannelType.GuildAnnouncement
                ))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for locking the channel')
                .setRequired(false)),

    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        const reason = interaction.options.getString('reason') || 'No reason provided';

        const channel = interaction.guild.channels.cache.get(targetChannel!.id);
        if (!channel) {
            await interaction.reply({ content: '❌ Channel not found.', ephemeral: true });
            return;
        }

        // Check if channel is already locked for @everyone
        const everyoneRole = interaction.guild.roles.everyone;
        const currentPerms = channel.permissionsFor(everyoneRole);

        if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildForum || channel.type === ChannelType.GuildAnnouncement) {
            if (!currentPerms?.has(PermissionFlagsBits.SendMessages)) {
                await interaction.reply({ content: '❌ This channel is already locked.', ephemeral: true });
                return;
            }
        } else if (channel.type === ChannelType.GuildVoice) {
            if (!currentPerms?.has(PermissionFlagsBits.Connect)) {
                await interaction.reply({ content: '❌ This channel is already locked.', ephemeral: true });
                return;
            }
        }

        await interaction.deferReply();

        try {
            const everyone = interaction.guild.roles.everyone;

            if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) {
                await channel.permissionOverwrites.edit(everyone, {
                    SendMessages: false,
                    SendMessagesInThreads: false,
                    CreatePublicThreads: false,
                    CreatePrivateThreads: false
                }, { reason: `Locked by ${interaction.user.tag}: ${reason}` });

                await channel.send(`🔒 **This channel has been locked.**\n**Reason:** ${reason}`);
            } else if (channel.type === ChannelType.GuildForum) {
                await channel.permissionOverwrites.edit(everyone, {
                    SendMessagesInThreads: false,
                    CreatePublicThreads: false,
                }, { reason: `Locked by ${interaction.user.tag}: ${reason}` });
            } else if (channel.type === ChannelType.GuildVoice) {
                await channel.permissionOverwrites.edit(everyone, {
                    Connect: false
                }, { reason: `Locked by ${interaction.user.tag}: ${reason}` });

                // Disconnect non-staff users if needed
                const members = channel.members;
                for (const [, member] of members) {
                    if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                        await member.voice.disconnect(`Channel locked by ${interaction.user.tag}: ${reason}`);
                    }
                }

                if (interaction.channel && 'send' in interaction.channel) {
                    await interaction.channel.send(`🔒 **${channel.name}** has been locked.`);
                }
            }

            await interaction.editReply(`✅ **${channel.name}** has been locked.`);
            logger.info(`${interaction.user.tag} locked channel ${channel.name} in ${interaction.guild.name}. Reason: ${reason}`);

        } catch (error) {
            logger.error('Error locking channel:', error);
            await interaction.editReply('❌ Failed to lock channel. Please check my permissions.');
        }
    }
};

export default command;
