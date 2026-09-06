import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, User } from 'discord.js';
import { Command } from '../types/Command';
import { db } from '../../shared/database/client';
import { moderationCase, moderationSettings } from '../../shared/database/schema';
import { eq, and, sql } from 'drizzle-orm';
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
        action: 'TIMEOUT',
        reason: reason ? `Timeout removed: ${reason}` : 'Timeout removed',
        active: false,
    }).returning();

    await emitGuildNotificationSafe({
        guildId,
        eventType: 'MOD_CASE_CREATED_UNTIMEOUT',
        severity: 'INFO',
        source: 'BOT_EVENT',
        title: `Timeout removal case #${caseNumber} created`,
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
    target: User,
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
        title: `Timeout Removed | Case #${caseNumber}`,
        fields: [
            { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
            { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
            { name: 'Reason', value: reason || 'No reason provided', inline: false },
        ],
        timestamp: new Date().toISOString(),
    };

    await logChannel.send({ embeds: [embed] });
}

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('untimeout')
        .setDescription('Remove timeout from a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to remove timeout from')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for removing timeout')
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const targetUser = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || undefined;

        const member = interaction.guild.members.cache.get(targetUser.id);
        if (!member) {
            await interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });
            return;
        }

        // Check if user is timed out
        if (!member.isCommunicationDisabled()) {
            await interaction.reply({ content: '❌ This user is not timed out.', ephemeral: true });
            return;
        }

        // Check if we can moderate this user
        if (!member.moderatable) {
            await interaction.reply({ 
                content: '❌ I cannot remove timeout from this user. They may have higher permissions than me.', 
                ephemeral: true 
            });
            return;
        }

        await interaction.deferReply();

        try {
            // Remove timeout
            await member.timeout(null, reason);

            // Deactivate active timeout cases
            await db.update(moderationCase)
                .set({ active: false })
                .where(and(
                    eq(moderationCase.guildId, interaction.guildId!),
                    eq(moderationCase.userId, targetUser.id),
                    eq(moderationCase.action, 'TIMEOUT'),
                    eq(moderationCase.active, true)
                ));

            // Create mod case for the removal
            const modCase = await createModCase(
                interaction.guildId!,
                targetUser.id,
                interaction.user.id,
                reason
            );

            await sendModLog(interaction, targetUser, modCase.caseNumber, reason);

            // DM the user
            try {
                await targetUser.send(`⏱️ Your timeout has been removed in ${interaction.guild.name}${reason ? `: ${reason}` : '.'}`);
            } catch {
                // Ignore DM errors
            }

            await interaction.editReply(`✅ Timeout removed from **${targetUser.tag}** (Case #${modCase.caseNumber})`);
            logger.info(`${interaction.user.tag} removed timeout from ${targetUser.tag} in ${interaction.guild.name}`);

        } catch (error) {
            logger.error('Error removing timeout:', error);
            await interaction.editReply('❌ Failed to remove timeout. Please check my permissions.');
        }
    }
};

export default command;
