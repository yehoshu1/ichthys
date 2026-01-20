import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../types/Command';
import { db } from '../../shared/database/client';
import { userJoin, actionLog, levelProfile } from '../../shared/database/schema';
import { eq, gt, sql, desc, and } from 'drizzle-orm';

export const info: Command = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('View a quick analytics overview for this server'),

    async execute(interaction) {
        const guildId = interaction.guildId;
        const guild = interaction.guild;

        if (!guildId || !guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const memberCounts = await db
                .select({
                    total: sql<number>`count(*)`,
                    verified: sql<number>`sum(case when ${userJoin.isVerified} then 1 else 0 end)`
                })
                .from(userJoin)
                .where(and(eq(userJoin.guildId, guildId), eq(userJoin.isBot, false)));

            const totalMembers = memberCounts[0]?.total || 0;
            const verifiedMembers = memberCounts[0]?.verified || 0;
            const verifiedPct = totalMembers > 0 ? Math.round((verifiedMembers / totalMembers) * 100) : 0;

            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const actionsResult = await db
                .select({ count: sql<number>`count(*)` })
                .from(actionLog)
                .where(and(eq(actionLog.guildId, guildId), gt(actionLog.executedAt, yesterday)));

            const actions24h = actionsResult[0]?.count || 0;

            const voiceStats = await db
                .select({ minutes: sql<number>`sum(${levelProfile.totalVoiceMinutes})` })
                .from(levelProfile)
                .where(eq(levelProfile.guildId, guildId));

            const totalVoiceHours = Math.round((voiceStats[0]?.minutes || 0) / 60);

            const topUsers = await db
                .select({
                    userId: levelProfile.userId,
                    level: levelProfile.level,
                    totalXp: levelProfile.totalXp
                })
                .from(levelProfile)
                .where(eq(levelProfile.guildId, guildId))
                .orderBy(desc(levelProfile.totalXp))
                .limit(5);

            const leaderboard = topUsers.length > 0
                ? topUsers.map((u, i) => `**#${i + 1}** <@${u.userId}> · Lvl ${u.level} · ${u.totalXp.toLocaleString()} XP`).join('\n')
                : 'No XP data yet.';

            const embed = new EmbedBuilder()
                .setTitle(`📊 ${guild.name} Overview`)
                .setColor('#2CB7C9')
                .setThumbnail(guild.iconURL() || null)
                .addFields(
                    { name: 'Members', value: `${totalMembers.toLocaleString()} total`, inline: true },
                    { name: 'Verified', value: `${verifiedMembers.toLocaleString()} (${verifiedPct}%)`, inline: true },
                    { name: 'Boosts', value: `${guild.premiumSubscriptionCount || 0} active`, inline: true },
                    { name: 'Actions (24h)', value: `${actions24h}`, inline: true },
                    { name: 'Voice Hours', value: `${totalVoiceHours}h`, inline: true },
                    { name: 'Top XP', value: leaderboard, inline: false }
                )
                .setFooter({ text: 'Use the dashboard for deeper analytics.' });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply('An error occurred while generating the overview.');
        }
    }
};
