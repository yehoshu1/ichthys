import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, User } from 'discord.js';
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
    action: 'KICK',
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

    await emitGuildNotificationSafe({
        guildId,
        eventType: 'MOD_CASE_CREATED_KICK',
        severity: 'WARNING',
        source: 'BOT_EVENT',
        title: `Kick case #${caseNumber} created`,
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
        color: 0xFF4500,
        title: `Kick | Case #${caseNumber}`,
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
        .setName('kick')
        .setDescription('Kick a user from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for kicking')
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const target = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || undefined;

        const member = interaction.guild.members.cache.get(target.id);
        if (!member) {
            await interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });
            return;
        }

        if (!member.kickable) {
            await interaction.reply({ content: '❌ I cannot kick this user. They may have higher permissions than me.', ephemeral: true });
            return;
        }

        await interaction.deferReply();

        try {
            const modCase = await createModCase(
                interaction.guildId!,
                target.id,
                interaction.user.id,
                'KICK',
                reason
            );

            await sendModLog(interaction, target, modCase.caseNumber, reason);

            // DM the user
            try {
                await target.send(`👢 You have been kicked from ${interaction.guild.name}${reason ? `: ${reason}` : '.'}`);
            } catch {
                // Ignore DM errors
            }

            await member.kick(reason);

            await interaction.editReply(`👢 **${target.tag}** has been kicked (Case #${modCase.caseNumber})`);
        } catch (error) {
            logger.error('Error kicking user:', error);
            await interaction.editReply('❌ Failed to kick user. Please check my permissions.');
        }
    }
};

export default command;
