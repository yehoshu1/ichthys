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
    action: 'TIMEOUT',
    reason?: string,
    duration?: number,
    expiresAt?: Date
) {
    const caseNumber = await getNextCaseNumber(guildId);

    const [modCase] = await db.insert(moderationCase).values({
        guildId,
        caseNumber,
        userId,
        moderatorId,
        action,
        reason: reason || null,
        duration: duration || null,
        expiresAt: expiresAt || null,
        active: true,
    }).returning();

    await emitGuildNotificationSafe({
        guildId,
        eventType: 'MOD_CASE_CREATED_TIMEOUT',
        severity: 'WARNING',
        source: 'BOT_EVENT',
        title: `Timeout case #${caseNumber} created`,
        targetUserId: userId,
        actorUserId: moderatorId,
        metadata: {
            caseId: modCase.id,
            caseNumber,
            duration: duration ?? null,
        },
    });

    return modCase;
}

async function sendModLog(
    interaction: ChatInputCommandInteraction,
    target: User,
    caseNumber: number,
    duration: number,
    reason?: string
) {
    const settings = await db.query.moderationSettings.findFirst({
        where: eq(moderationSettings.guildId, interaction.guildId!)
    });

    if (!settings?.logChannelId) return;

    const logChannel = interaction.guild?.channels.cache.get(settings.logChannelId);
    if (!logChannel?.isTextBased()) return;

    const formatted = duration < 60 ? `${duration}m` : duration < 1440 ? `${Math.floor(duration / 60)}h` : `${Math.floor(duration / 1440)}d`;

    const embed = {
        color: 0x9932CC,
        title: `Timeout | Case #${caseNumber}`,
        fields: [
            { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
            { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
            { name: 'Duration', value: formatted, inline: true },
            { name: 'Reason', value: reason || 'No reason provided', inline: false },
        ],
        timestamp: new Date().toISOString(),
    };

    await logChannel.send({ embeds: [embed] });
}

function parseDuration(input: string): number | null {
    const match = input.match(/^(\d+)([mhd])$/);
    if (!match) return null;

    const [, amount, unit] = match;
    const num = parseInt(amount, 10);

    switch (unit) {
        case 'm': return num;
        case 'h': return num * 60;
        case 'd': return num * 1440;
        default: return null;
    }
}

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a user (mute them from chatting)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to timeout')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Timeout duration (e.g., 10m, 1h, 1d - max 28 days)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for timeout')
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const target = interaction.options.getUser('user', true);
        const durationStr = interaction.options.getString('duration', true);
        const reason = interaction.options.getString('reason') || undefined;

        const duration = parseDuration(durationStr);
        if (!duration) {
            await interaction.reply({
                content: '❌ Invalid duration format. Use format like: 10m, 1h, 1d',
                ephemeral: true
            });
            return;
        }

        // Max timeout is 28 days (40320 minutes)
        if (duration > 40320) {
            await interaction.reply({
                content: '❌ Timeout duration cannot exceed 28 days.',
                ephemeral: true
            });
            return;
        }

        const member = interaction.guild.members.cache.get(target.id);
        if (!member) {
            await interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });
            return;
        }

        if (!member.moderatable) {
            await interaction.reply({ content: '❌ I cannot timeout this user. They may have higher permissions than me.', ephemeral: true });
            return;
        }

        await interaction.deferReply();

        try {
            const expiresAt = new Date(Date.now() + duration * 60 * 1000);

            await member.timeout(duration * 60 * 1000, reason);

            const modCase = await createModCase(
                interaction.guildId!,
                target.id,
                interaction.user.id,
                'TIMEOUT',
                reason,
                duration,
                expiresAt
            );

            await sendModLog(interaction, target, modCase.caseNumber, duration, reason);

            // DM the user
            try {
                const formatted = duration < 60 ? `${duration}m` : duration < 1440 ? `${Math.floor(duration / 60)}h` : `${Math.floor(duration / 1440)}d`;
                await target.send(`⏱️ You have been timed out in ${interaction.guild.name} for ${formatted}${reason ? `: ${reason}` : '.'}`);
            } catch {
                // Ignore DM errors
            }

            const formatted = duration < 60 ? `${duration}m` : duration < 1440 ? `${Math.floor(duration / 60)}h` : `${Math.floor(duration / 1440)}d`;
            await interaction.editReply(`⏱️ **${target.tag}** has been timed out for ${formatted} (Case #${modCase.caseNumber})`);
        } catch (error) {
            logger.error('Error timing out user:', error);
            await interaction.editReply('❌ Failed to timeout user. Please check my permissions.');
        }
    }
};

export default command;
