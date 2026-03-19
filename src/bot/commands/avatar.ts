import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../types/Command';
import logger from '../utils/logger';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Display a user\'s avatar or banner')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to get the avatar of')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of image to display')
                .setRequired(false)
                .addChoices(
                    { name: 'Server Avatar', value: 'server' },
                    { name: 'Global Avatar', value: 'global' },
                    { name: 'Global Banner', value: 'banner_global' },
                    { name: 'Server Banner', value: 'banner_server' }
                )),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const imageType = interaction.options.getString('type') || 'global';

        await interaction.deferReply();

        try {
            const member = interaction.guild?.members.cache.get(targetUser.id);
            let embed = new EmbedBuilder();

            if (imageType === 'banner_global') {
                // Fetch user to get global banner (may need to fetch if not cached)
                const fetchedUser = await targetUser.fetch();
                const bannerURL = fetchedUser.bannerURL({ size: 4096 });

                if (!bannerURL) {
                    await interaction.editReply({ content: '❌ This user does not have a global banner.' });
                    return;
                }

                embed = embed
                    .setTitle(`${targetUser.username}'s Global Banner`)
                    .setImage(bannerURL)
                    .setColor(fetchedUser.accentColor || '#5865F2');
            } else if (imageType === 'banner_server') {
                // Fetch member to get server-specific banner
                const fetchedMember = member ?? await interaction.guild?.members.fetch(targetUser.id);
                const bannerURL = fetchedMember?.bannerURL({ size: 4096 }) ?? null;
                const isServerBanner = fetchedMember?.banner != null;

                if (!isServerBanner) {
                    // Fall back to global banner with a note
                    const fetchedUser = await targetUser.fetch();
                    const globalBannerURL = fetchedUser.bannerURL({ size: 4096 });

                    if (!globalBannerURL) {
                        await interaction.editReply({ content: '❌ This user does not have a server or global banner.' });
                        return;
                    }

                    embed = embed
                        .setTitle(`${targetUser.username}'s Banner`)
                        .setImage(globalBannerURL)
                        .setDescription('*This user does not have a server-specific banner. Showing global banner.*')
                        .setColor(fetchedUser.accentColor || '#5865F2');
                } else {
                    embed = embed
                        .setTitle(`${targetUser.username}'s Server Banner`)
                        .setImage(bannerURL)
                        .setColor(fetchedMember?.displayHexColor || '#5865F2');
                }
            } else if (imageType === 'server' && member) {
                // Server-specific avatar
                const avatarURL = member.displayAvatarURL({ size: 4096 });
                const isServerAvatar = member.avatar !== null;

                embed = embed
                    .setTitle(`${targetUser.username}'s ${isServerAvatar ? 'Server' : 'Global'} Avatar`)
                    .setImage(avatarURL)
                    .setColor(member.displayHexColor || '#5865F2');

                if (!isServerAvatar) {
                    embed.setDescription('*This user does not have a server-specific avatar. Showing global avatar.*');
                }
            } else {
                // Global avatar
                const avatarURL = targetUser.displayAvatarURL({ size: 4096 });
                
                embed = embed
                    .setTitle(`${targetUser.username}'s Avatar`)
                    .setImage(avatarURL)
                    .setColor(member?.displayHexColor || '#5865F2');
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Error fetching avatar:', error);
            await interaction.editReply({ content: 'There was an error fetching the avatar.' });
        }
    }
};

export default command;
