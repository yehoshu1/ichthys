import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, ChannelType } from 'discord.js';
import type { Command } from '../types/Command';
import { db } from '../../shared/database/client';
import { moderationCase, moderationSettings } from '../../shared/database/schema';
import { eq, sql } from 'drizzle-orm';
import logger from '../utils/logger';

async function getNextCaseNumber(guildId: string): Promise<number> {
    const result = await db
        .select({ maxCase: sql<number>`max(${moderationCase.caseNumber})` })
        .from(moderationCase)
        .where(eq(moderationCase.guildId, guildId));
    return (result[0]?.maxCase || 0) + 1;
}

async function createModCase(
    guildId: string,
    userId: string,
    moderatorId: string,
    action: 'WARN',
    reason?: string
) {
    const caseNumber = await getNextCaseNumber(guildId);

    const [modCase] = await db.insert(moderationCase).values({
        guildId,
        caseNumber,
        userId,
        moderatorId,
        action,
        reason: reason || null,
        active: false,
    }).returning();

    return modCase;
}

async function sendModLog(
    interaction: ChatInputCommandInteraction,
    amount: number,
    caseNumber: number,
    targetId?: string
) {
    const settings = await db.query.moderationSettings.findFirst({
        where: eq(moderationSettings.guildId, interaction.guildId!)
    });

    if (!settings?.logChannelId) return;

    const logChannel = interaction.guild?.channels.cache.get(settings.logChannelId);
    if (!logChannel?.isTextBased()) return;

    const targetText = targetId ? `<@${targetId}>` : 'all users';

    const embed = {
        color: 0x3498db,
        title: `Message Clear | Case #${caseNumber}`,
        fields: [
            { name: 'Channel', value: `<#${interaction.channelId}>`, inline: true },
            { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
            { name: 'Amount', value: `${amount} messages`, inline: true },
            { name: 'Target', value: targetText, inline: true },
        ],
        timestamp: new Date().toISOString(),
    };

    await logChannel.send({ embeds: [embed] });
}

const command: Command = {
    moduleId: 'moderation',
    limitOptionName: 'amount',
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear messages in the current channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to clear (1-100)')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Only clear messages from this user')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for clearing messages')
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const channel = interaction.channel;
        if (!channel || channel.type !== ChannelType.GuildText) {
            await interaction.reply({ content: '❌ This command can only be used in text channels.', ephemeral: true });
            return;
        }

        const amount = interaction.options.getInteger('amount', true);
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || undefined;

        await interaction.deferReply({ ephemeral: true });

        try {
            const messages = await channel.messages.fetch({ limit: amount });

            const messagesToDelete = targetUser
                ? messages.filter(m => m.author.id === targetUser.id)
                : messages;

            if (messagesToDelete.size === 0) {
                await interaction.editReply({ content: '❌ No messages found to delete.' });
                return;
            }

            // Bulk delete messages
            const deleted = await channel.bulkDelete(messagesToDelete, true);

            // Create mod case for logging
            const modCase = await createModCase(
                interaction.guildId!,
                targetUser?.id || interaction.user.id,
                interaction.user.id,
                'WARN',
                `Cleared ${deleted.size} messages${reason ? `: ${reason}` : ''}`
            );

            await sendModLog(interaction, deleted.size, modCase.caseNumber, targetUser?.id);

            const targetText = targetUser ? ` from ${targetUser.tag}` : '';
            await interaction.editReply(`🗑️ Deleted ${deleted.size} message${deleted.size === 1 ? '' : 's'}${targetText}.`);
        } catch (error) {
            logger.error('Error clearing messages:', error);
            await interaction.editReply({
                content: '❌ Failed to clear messages. Messages older than 14 days cannot be bulk deleted.'
            });
        }
    }
};

export default command;
