import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, User } from 'discord.js';
import type { Command } from '../types/Command';
import { db } from '../../shared/database/client';
import { moderationCase, moderationSettings } from '../../shared/database/schema';
import { eq, sql } from 'drizzle-orm';
import logger from '../utils/logger';
import { emitGuildNotificationSafe } from '../services/notificationEmitter';

const MODERATION_ACTIONS = {
    BAN: { color: 0xDC143C, label: 'Ban' },
    UNBAN: { color: 0x32CD32, label: 'Unban' },
} as const;

type ModAction = keyof typeof MODERATION_ACTIONS;

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
    action: ModAction,
    reason?: string,
    duration?: number | null,
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
        duration: duration ?? null,
        expiresAt: expiresAt || null,
        active: action !== 'UNBAN',
    }).returning();

    await emitGuildNotificationSafe({
        guildId,
        eventType: action === 'BAN' ? 'MOD_CASE_CREATED_BAN' : 'MOD_CASE_CREATED_UNBAN',
        severity: action === 'BAN' ? 'ERROR' : 'INFO',
        source: 'BOT_EVENT',
        title: `${action} case #${caseNumber} created`,
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
    action: ModAction,
    caseNumber: number,
    reason?: string,
    duration?: number | null
) {
    const settings = await db.query.moderationSettings.findFirst({
        where: eq(moderationSettings.guildId, interaction.guildId!)
    });

    if (!settings?.logChannelId) return;

    const logChannel = interaction.guild?.channels.cache.get(settings.logChannelId);
    if (!logChannel?.isTextBased()) return;

    const actionInfo = MODERATION_ACTIONS[action];
    const embed = {
        color: actionInfo.color,
        title: `${actionInfo.label} | Case #${caseNumber}`,
        fields: [
            { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
            { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
            { name: 'Reason', value: reason || 'No reason provided', inline: false },
        ],
        timestamp: new Date().toISOString(),
    };

    if (duration) {
        const formatted = duration < 60 ? `${duration}m` : duration < 1440 ? `${Math.floor(duration / 60)}h` : `${Math.floor(duration / 1440)}d`;
        embed.fields.push({
            name: 'Duration',
            value: formatted,
            inline: true
        });
    }

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
        .setName('ban')
        .setDescription('Ban a user from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for banning')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Ban duration (e.g., 1d, 7d, 30d - omit for permanent)')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('delete_messages')
                .setDescription('Delete messages from last X days (0-7, default: 1)')
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const target = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || undefined;
        const durationStr = interaction.options.getString('duration');
        const deleteDays = interaction.options.getInteger('delete_messages') ?? 1;

        const member = interaction.guild.members.cache.get(target.id);
        if (member && !member.bannable) {
            await interaction.reply({ content: '❌ I cannot ban this user. They may have higher permissions than me.', ephemeral: true });
            return;
        }

        let duration: number | null = null;
        let expiresAt: Date | undefined;

        if (durationStr) {
            duration = parseDuration(durationStr);
            if (!duration) {
                await interaction.reply({
                    content: '❌ Invalid duration format. Use format like: 1d, 7d, 30d',
                    ephemeral: true
                });
                return;
            }
            expiresAt = new Date(Date.now() + duration * 60 * 1000);
        }

        await interaction.deferReply();

        try {
            const modCase = await createModCase(
                interaction.guildId!,
                target.id,
                interaction.user.id,
                'BAN',
                reason,
                duration,
                expiresAt
            );

            await sendModLog(interaction, target, 'BAN', modCase.caseNumber, reason, duration);

            // DM the user
            try {
                const durationText = duration ? ` for ${duration < 60 ? `${duration}m` : duration < 1440 ? `${Math.floor(duration / 60)}h` : `${Math.floor(duration / 1440)}d`}` : '';
                await target.send(`🔨 You have been banned from ${interaction.guild.name}${durationText}${reason ? `: ${reason}` : '.'}`);
            } catch {
                // Ignore DM errors
            }

            await interaction.guild.members.ban(target, {
                reason,
                deleteMessageSeconds: deleteDays * 86400
            });

            const durationText = duration ? ` for ${duration < 60 ? `${duration}m` : duration < 1440 ? `${Math.floor(duration / 60)}h` : `${Math.floor(duration / 1440)}d`}` : ' permanently';
            await interaction.editReply(`🔨 **${target.tag}** has been banned${durationText} (Case #${modCase.caseNumber})`);
        } catch (error) {
            logger.error('Error banning user:', error);
            await interaction.editReply('❌ Failed to ban user. Please check my permissions.');
        }
    }
};

export default command;
