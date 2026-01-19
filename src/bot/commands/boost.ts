import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../types/Command';
import { db } from '../../shared/database/client';
import { userBoost, guildConfig } from '../../shared/database/schema';
import { eq, and } from 'drizzle-orm';

export const boost: Command = {
    data: new SlashCommandBuilder()
        .setName('boost')
        .setDescription('Check your server boost status')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check your current boost status and rewards')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'status') {
            const guildId = interaction.guildId!;
            const userId = interaction.user.id;
            const member = interaction.member as any;

            try {
                const config = await db.query.guildConfig.findFirst({
                    where: eq(guildConfig.guildId, guildId)
                });

                const boostRecord = await db.query.userBoost.findFirst({
                    where: and(
                        eq(userBoost.guildId, guildId),
                        eq(userBoost.userId, userId)
                    )
                });

                const isPremium = member.premiumSince !== null;
                const premiumSince = member.premiumSince;

                const embed = new EmbedBuilder()
                    .setTitle('🚀 Your Boost Status')
                    .setColor(isPremium ? '#F47FFF' : '#4F545C')
                    .setThumbnail(interaction.user.displayAvatarURL());

                if (isPremium) {
                    embed.addFields(
                        { name: 'Status', value: '✨ **Active Booster**', inline: true },
                        { name: 'Boosting Since', value: premiumSince ? `<t:${Math.floor(premiumSince.getTime() / 1000)}:R>` : 'Unknown', inline: true }
                    );

                    if (config?.boostRoleId) {
                        const hasRole = member.roles.cache.has(config.boostRoleId);
                        embed.addFields({
                            name: 'Reward Role',
                            value: hasRole ? `<@&${config.boostRoleId}> ✅` : `<@&${config.boostRoleId}> ⏳ (Pending)`,
                            inline: true
                        });
                    }

                    if (boostRecord) {
                        embed.addFields({
                            name: 'Reward Expires',
                            value: `<t:${Math.floor(boostRecord.boostEndsAt.getTime() / 1000)}:D>`,
                            inline: true
                        });
                    }
                } else {
                    embed.setDescription('You are not currently boosting this server.');

                    if (boostRecord && !boostRecord.roleRemoved) {
                        embed.addFields({
                            name: '⚠️ Grace Period',
                            value: `Your boost reward role will be removed <t:${Math.floor(boostRecord.boostEndsAt.getTime() / 1000)}:R>`,
                        });
                    }
                }

                // Server boost stats
                const guild = interaction.guild!;
                embed.addFields({
                    name: 'Server Stats',
                    value: `**Level:** ${guild.premiumTier}\n**Total Boosts:** ${guild.premiumSubscriptionCount || 0}`,
                    inline: false
                });

                await interaction.reply({ embeds: [embed], ephemeral: true });

            } catch (error) {
                console.error('Error checking boost status:', error);
                await interaction.reply({ content: 'An error occurred while checking your boost status.', ephemeral: true });
            }
        }
    }
};
