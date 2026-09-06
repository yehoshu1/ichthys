import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { Command } from '../types/Command';
import { db } from '../../shared/database/client';
import { moderationCase } from '../../shared/database/schema';
import { eq, and, desc } from 'drizzle-orm';
import logger from '../utils/logger';

const ACTION_LABELS: Record<string, string> = {
    WARN: 'Warning',
    MUTE: 'Mute',
    UNMUTE: 'Unmute',
    KICK: 'Kick',
    BAN: 'Ban',
    UNBAN: 'Unban',
    TIMEOUT: 'Timeout',
};

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('cases')
        .setDescription('View moderation cases for a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to view cases for')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('active_only')
                .setDescription('Only show active cases')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number')
                .setMinValue(1)
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const target = interaction.options.getUser('user', true);
        const activeOnly = interaction.options.getBoolean('active_only') || false;
        const page = interaction.options.getInteger('page') || 1;
        const perPage = 5;

        await interaction.deferReply({ ephemeral: true });

        try {
            let query = db.select()
                .from(moderationCase)
                .where(and(
                    eq(moderationCase.guildId, interaction.guildId!),
                    eq(moderationCase.userId, target.id)
                ))
                .orderBy(desc(moderationCase.createdAt));

            if (activeOnly) {
                query = db.select()
                    .from(moderationCase)
                    .where(and(
                        eq(moderationCase.guildId, interaction.guildId!),
                        eq(moderationCase.userId, target.id),
                        eq(moderationCase.active, true)
                    ))
                    .orderBy(desc(moderationCase.createdAt)) as typeof query;
            }

            const allCases = await query;

            if (allCases.length === 0) {
                await interaction.editReply(`✅ No ${activeOnly ? 'active ' : ''}moderation cases found for **${target.tag}**.`);
                return;
            }

            const totalPages = Math.ceil(allCases.length / perPage);
            const currentPage = Math.min(page, totalPages);
            const startIdx = (currentPage - 1) * perPage;
            const pageCases = allCases.slice(startIdx, startIdx + perPage);

            const embed = new EmbedBuilder()
                .setTitle(`Moderation Cases for ${target.tag}`)
                .setDescription(`Total cases: ${allCases.length}${activeOnly ? ' (active only)' : ''}`)
                .setColor(0x5865F2)
                .setFooter({ text: `Page ${currentPage}/${totalPages}` })
                .setTimestamp();

            for (const c of pageCases) {
                const actionLabel = ACTION_LABELS[c.action] || c.action;
                const status = c.active ? '🟢 Active' : '⚫ Inactive';
                const moderator = await interaction.client.users.fetch(c.moderatorId).catch((error) => { logger.warn(`Failed to fetch moderator ${c.moderatorId} for case display:`, error); return null; });

                let value = `**Case #${c.caseNumber}** | ${status}\n`;
                value += `**Action:** ${actionLabel}\n`;
                value += `**Moderator:** ${moderator ? moderator.tag : 'Unknown'}\n`;
                if (c.reason) value += `**Reason:** ${c.reason}\n`;
                if (c.duration) {
                    const formatted = c.duration < 60 ? `${c.duration}m` : c.duration < 1440 ? `${Math.floor(c.duration / 60)}h` : `${Math.floor(c.duration / 1440)}d`;
                    value += `**Duration:** ${formatted}\n`;
                }
                value += `**Date:** <t:${Math.floor(new Date(c.createdAt).getTime() / 1000)}:R>`;

                embed.addFields({
                    name: `${actionLabel} #${c.caseNumber}`,
                    value: value,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logger.error('Error fetching cases:', error);
            await interaction.editReply('❌ Failed to fetch moderation cases.');
        }
    }
};

export default command;
