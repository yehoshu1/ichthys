import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { Command } from '../types/Command';
import logger from '../utils/logger';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock a previously locked channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to unlock (default: current channel)')
                .setRequired(false)
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildVoice,
                    ChannelType.GuildForum,
                    ChannelType.GuildAnnouncement
                )),

    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

        const channel = interaction.guild.channels.cache.get(targetChannel!.id);
        if (!channel) {
            await interaction.reply({ content: '❌ Channel not found.', ephemeral: true });
            return;
        }

        await interaction.deferReply();

        try {
            const everyone = interaction.guild.roles.everyone;

            if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildForum || channel.type === ChannelType.GuildAnnouncement) {
                // Check if we need to restore previous permissions or just allow SendMessages
                // For simplicity, we'll enable SendMessages and related perms
                await channel.permissionOverwrites.edit(everyone, {
                    SendMessages: null,  // null = inherit from category/default
                    SendMessagesInThreads: null,
                    CreatePublicThreads: null,
                    CreatePrivateThreads: null
                }, { reason: `Unlocked by ${interaction.user.tag}` });

                if ('send' in channel) {
                    await channel.send(`🔓 **This channel has been unlocked.**`);
                }
            } else if (channel.type === ChannelType.GuildVoice) {
                await channel.permissionOverwrites.edit(everyone, {
                    Connect: null  // null = inherit from category/default
                }, { reason: `Unlocked by ${interaction.user.tag}` });
            }

            await interaction.editReply(`✅ **${channel.name}** has been unlocked.`);
            logger.info(`${interaction.user.tag} unlocked channel ${channel.name} in ${interaction.guild.name}`);

        } catch (error) {
            logger.error('Error unlocking channel:', error);
            await interaction.editReply('❌ Failed to unlock channel. Please check my permissions.');
        }
    }
};

export default command;
