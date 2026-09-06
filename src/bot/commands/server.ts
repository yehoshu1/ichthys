import { SlashCommandBuilder, EmbedBuilder, ChannelType } from 'discord.js';
import { Command } from '../types/Command';
import { db } from '../../shared/database/client';
import { userJoin, levelProfile } from '../../shared/database/schema';
import { eq, sql, and } from 'drizzle-orm';
import logger from '../utils/logger';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('server')
        .setDescription('Display detailed information about this server'),

    async execute(interaction) {
        const guild = interaction.guild;

        if (!guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        await interaction.deferReply();

        try {
            // Get database stats
            const memberCounts = await db
                .select({
                    total: sql<number>`count(*)`,
                    verified: sql<number>`sum(case when ${userJoin.isVerified} then 1 else 0 end)`
                })
                .from(userJoin)
                .where(and(
                    eq(userJoin.guildId, guild.id),
                    eq(userJoin.isBot, false)
                ));

            const totalTrackedMembers = memberCounts[0]?.total || 0;
            const verifiedMembers = memberCounts[0]?.verified || 0;

            // Count channels
            const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
            const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
            const categoryChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
            const stageChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildStageVoice).size;
            const forumChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildForum).size;

            // Count roles
            const roleCount = guild.roles.cache.size - 1; // Exclude @everyone

            // Count emojis
            const emojiCount = guild.emojis.cache.size;
            const animatedEmojis = guild.emojis.cache.filter(e => e.animated).size;
            const staticEmojis = emojiCount - animatedEmojis;

            // Get owner
            const owner = await guild.fetchOwner();

            // Get total voice hours from database
            const voiceStats = await db
                .select({ minutes: sql<number>`sum(${levelProfile.totalVoiceMinutes})` })
                .from(levelProfile)
                .where(eq(levelProfile.guildId, guild.id));
            const totalVoiceHours = Math.round((voiceStats[0]?.minutes || 0) / 60);

            const embed = new EmbedBuilder()
                .setTitle(`📊 ${guild.name} Server Information`)
                .setThumbnail(guild.iconURL({ size: 256 }))
                .setColor('#2CB7C9')
                .addFields(
                    { name: '📛 Server Name', value: guild.name, inline: true },
                    { name: '🆔 Server ID', value: guild.id, inline: true },
                    { name: '👑 Owner', value: `${owner.user.tag}`, inline: true },
                    { name: '👥 Members', value: `${guild.memberCount.toLocaleString()}`, inline: true },
                    { name: '🤖 Bots', value: `${guild.members.cache.filter(m => m.user.bot).size}`, inline: true },
                    { name: '⭐ Boosts', value: `${guild.premiumSubscriptionCount || 0} (Level ${guild.premiumTier})`, inline: true },
                    { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: false }
                );

            // Channels info
            embed.addFields({
                name: '📺 Channels',
                value: [
                    `Text: ${textChannels}`,
                    `Voice: ${voiceChannels}`,
                    `Stage: ${stageChannels}`,
                    `Forum: ${forumChannels}`,
                    `Categories: ${categoryChannels}`
                ].join(' | '),
                inline: false
            });

            // Roles and emojis
            embed.addFields(
                { name: '🎨 Roles', value: `${roleCount}`, inline: true },
                { name: '😀 Emojis', value: `${staticEmojis} static, ${animatedEmojis} animated`, inline: true }
            );

            // Verification level and content filter
            const verificationLevels = ['None', 'Low', 'Medium', 'High', 'Very High'];
            const contentFilterLevels = ['Disabled', 'Members without roles', 'All members'];

            embed.addFields(
                { name: '🔒 Verification Level', value: verificationLevels[guild.verificationLevel], inline: true },
                { name: '🛡️ Content Filter', value: contentFilterLevels[guild.explicitContentFilter], inline: true },
                { name: 'ℹ️ MFA Level', value: guild.mfaLevel === 0 ? 'None' : 'Elevated', inline: true }
            );

            // Database stats
            if (totalTrackedMembers > 0) {
                const verifiedPct = Math.round((verifiedMembers / totalTrackedMembers) * 100);
                embed.addFields({
                    name: '📈 Tracked Stats',
                    value: `Verified Members: ${verifiedMembers}/${totalTrackedMembers} (${verifiedPct}%) | Total Voice Hours: ${totalVoiceHours}h`,
                    inline: false
                });
            }

            // Features
            const features = guild.features
                .map(f => f.replace(/_/g, ' ').toLowerCase())
                .map(f => f.charAt(0).toUpperCase() + f.slice(1));
            
            if (features.length > 0) {
                embed.addFields({
                    name: '✨ Server Features',
                    value: features.slice(0, 10).join(', ') + (features.length > 10 ? ` and ${features.length - 10} more...` : ''),
                    inline: false
                });
            }

            embed.setFooter({ text: `Requested by ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Error fetching server info:', error);
            await interaction.editReply({ content: 'There was an error fetching server information.' });
        }
    }
};

export default command;
