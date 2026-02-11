import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../types/Command';
import { db } from '../../shared/database/client';
import { moderationCase, moderationSettings } from '../../shared/database/schema';
import { eq, sql } from 'drizzle-orm';
import logger from '../utils/logger';
import { emitGuildNotificationSafe } from '../services/notificationEmitter';

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
    reason?: string
) {
    const caseNumber = await getNextCaseNumber(guildId);

    const [modCase] = await db.insert(moderationCase).values({
        guildId,
        caseNumber,
        userId,
        moderatorId,
        action: 'UNBAN',
        reason: reason || null,
        active: false,
    }).returning();

    await emitGuildNotificationSafe({
        guildId,
        eventType: 'MOD_CASE_CREATED_UNBAN',
        severity: 'INFO',
        source: 'BOT_EVENT',
        title: `Unban case #${caseNumber} created`,
        targetUserId: userId,
        actorUserId: moderatorId,
        metadata: {
            caseId: modCase.id,
            caseNumber,
        },
    });

    return modCase;
}

async function sendModLog(
    interaction: ChatInputCommandInteraction,
    targetId: string,
    caseNumber: number,
    reason?: string
) {
    const settings = await db.query.moderationSettings.findFirst({
        where: eq(moderationSettings.guildId, interaction.guildId!)
    });

    if (!settings?.logChannelId) return;

    const logChannel = interaction.guild?.channels.cache.get(settings.logChannelId);
    if (!logChannel?.isTextBased()) return;

    const embed = {
        color: 0x32CD32,
        title: `Unban | Case #${caseNumber}`,
        fields: [
            { name: 'User ID', value: targetId, inline: true },
            { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
            { name: 'Reason', value: reason || 'No reason provided', inline: false },
        ],
        timestamp: new Date().toISOString(),
    };

    await logChannel.send({ embeds: [embed] });
}

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(option =>
            option.setName('user_id')
                .setDescription('ID of the user to unban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for unbanning')
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const userId = interaction.options.getString('user_id', true);
        const reason = interaction.options.getString('reason') || undefined;

        await interaction.deferReply();

        try {
            await interaction.guild.members.unban(userId, reason);

            const modCase = await createModCase(
                interaction.guildId!,
                userId,
                interaction.user.id,
                reason
            );

            await sendModLog(interaction, userId, modCase.caseNumber, reason);

            await interaction.editReply(`🔓 User has been unbanned (Case #${modCase.caseNumber})`);
        } catch (error) {
            logger.error('Error unbanning user:', error);
            await interaction.editReply('❌ Failed to unban user. Make sure the ID is correct and the user is actually banned.');
        }
    }
};

export default command;
