import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../types/Command';

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
                    { name: 'Banner', value: 'banner' }
                )),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const imageType = interaction.options.getString('type') || 'global';

        await interaction.deferReply();

        try {
            const member = interaction.guild?.members.cache.get(targetUser.id);
            let embed = new EmbedBuilder();

            if (imageType === 'banner') {
                // Fetch user to get banner (may need to fetch if not cached)
                const fetchedUser = await targetUser.fetch();
                const bannerURL = fetchedUser.bannerURL({ size: 4096 });

                if (!bannerURL) {
                    await interaction.editReply({ content: '❌ This user does not have a banner.' });
                    return;
                }

                embed = embed
                    .setTitle(`${targetUser.username}'s Banner`)
                    .setImage(bannerURL)
                    .setColor(fetchedUser.accentColor || '#5865F2');
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
            console.error('Error fetching avatar:', error);
            await interaction.editReply({ content: 'There was an error fetching the avatar.' });
        }
    }
};

export default command;
