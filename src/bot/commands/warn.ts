import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, User, EmbedBuilder } from 'discord.js';
import type { Command } from '../types/Command';
import { db } from '../../shared/database/client';
import { moderationCase, moderationSettings } from '../../shared/database/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
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
        active: true,
    }).returning();

    await emitGuildNotificationSafe({
        guildId,
        eventType: 'MOD_CASE_CREATED_WARN',
        severity: 'WARNING',
        source: 'BOT_EVENT',
        title: `Warning case #${caseNumber} created`,
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
        color: 0xFFA500,
        title: `Warning | Case #${caseNumber}`,
        fields: [
            { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
            { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
            { name: 'Reason', value: reason || 'No reason provided', inline: false },
        ],
        timestamp: new Date().toISOString(),
    };

    await logChannel.send({ embeds: [embed] });
}

async function getWarningCount(guildId: string, userId: string): Promise<number> {
    const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(moderationCase)
        .where(and(
            eq(moderationCase.guildId, guildId),
            eq(moderationCase.userId, userId),
            eq(moderationCase.action, 'WARN'),
            eq(moderationCase.active, true)
        ));
    return result[0]?.count || 0;
}

async function handleWarn(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || undefined;

    const member = interaction.guild!.members.cache.get(target.id);
    if (!member) {
        await interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });
        return;
    }

    await interaction.deferReply();

    try {
        const modCase = await createModCase(
            interaction.guildId!,
            target.id,
            interaction.user.id,
            'WARN',
            reason
        );

        await sendModLog(interaction, target, modCase.caseNumber, reason);

        // DM the user
        try {
            await target.send(`⚠️ You have been warned in ${interaction.guild!.name}${reason ? `: ${reason}` : '.'}`);
        } catch {
            // Ignore DM errors
        }

        const warningCount = await getWarningCount(interaction.guildId!, target.id);

        await interaction.editReply(`⚠️ **${target.tag}** has been warned (Case #${modCase.caseNumber}) - Total warnings: ${warningCount}`);
    } catch (error) {
        logger.error('Error warning user:', error);
        await interaction.editReply('❌ Failed to warn user.');
    }
}

async function handleWarnRemove(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user');
    const warnId = interaction.options.getString('warn_id');
    const removeAll = interaction.options.getString('scope') === 'all';

    await interaction.deferReply();

    try {
        if (removeAll && target) {
            // Remove all warnings for a user
            await db.update(moderationCase)
                .set({ active: false })
                .where(and(
                    eq(moderationCase.guildId, interaction.guildId!),
                    eq(moderationCase.userId, target.id),
                    eq(moderationCase.action, 'WARN'),
                    eq(moderationCase.active, true)
                ));

            await interaction.editReply(`✅ All active warnings for **${target.tag}** have been removed.`);
            logger.info(`${interaction.user.tag} removed all warnings for ${target.tag} in ${interaction.guild!.name}`);
            await emitGuildNotificationSafe({
                guildId: interaction.guildId!,
                eventType: 'MOD_WARNING_REMOVED',
                severity: 'INFO',
                source: 'BOT_EVENT',
                title: `All warnings removed for ${target.tag}`,
                targetUserId: target.id,
                actorUserId: interaction.user.id,
                metadata: {
                    scope: 'all',
                },
            });

        } else if (warnId) {
            // Remove specific warning by case number
            const caseNumber = parseInt(warnId, 10);
            if (isNaN(caseNumber)) {
                await interaction.editReply('❌ Invalid warning ID. Please provide a valid case number.');
                return;
            }

            const warning = await db.query.moderationCase.findFirst({
                where: and(
                    eq(moderationCase.guildId, interaction.guildId!),
                    eq(moderationCase.caseNumber, caseNumber),
                    eq(moderationCase.action, 'WARN')
                )
            });

            if (!warning) {
                await interaction.editReply('❌ Warning not found.');
                return;
            }

            await db.update(moderationCase)
                .set({ active: false })
                .where(eq(moderationCase.id, warning.id));

            const user = await interaction.client.users.fetch(warning.userId).catch((error) => { logger.warn(`Failed to fetch user ${warning.userId} for warning display:`, error); return null; });

            await interaction.editReply(`✅ Warning Case #${caseNumber} for **${user?.tag || warning.userId}** has been removed.`);
            logger.info(`${interaction.user.tag} removed warning Case #${caseNumber} in ${interaction.guild!.name}`);
            await emitGuildNotificationSafe({
                guildId: interaction.guildId!,
                eventType: 'MOD_WARNING_REMOVED',
                severity: 'INFO',
                source: 'BOT_EVENT',
                title: `Warning case #${caseNumber} removed`,
                targetUserId: warning.userId,
                actorUserId: interaction.user.id,
                metadata: {
                    caseId: warning.id,
                    caseNumber,
                    scope: 'single',
                },
            });

        } else {
            await interaction.editReply('❌ Please specify either a user to clear all warnings, or a specific warning ID.');
        }

    } catch (error) {
        logger.error('Error removing warning:', error);
        await interaction.editReply('❌ Failed to remove warning.');
    }
}

async function handleWarnings(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user') || interaction.user;

    await interaction.deferReply();

    try {
        const warnings = await db.query.moderationCase.findMany({
            where: and(
                eq(moderationCase.guildId, interaction.guildId!),
                eq(moderationCase.userId, target.id),
                eq(moderationCase.action, 'WARN')
            ),
            orderBy: desc(moderationCase.createdAt)
        });

        if (warnings.length === 0) {
            await interaction.editReply(`✅ **${target.tag}** has no warnings.`);
            return;
        }

        const activeWarnings = warnings.filter(w => w.active);
        const inactiveWarnings = warnings.filter(w => !w.active);

        const embed = new EmbedBuilder()
            .setTitle(`⚠️ Warnings for ${target.tag}`)
            .setColor(0xFFA500)
            .setThumbnail(target.displayAvatarURL())
            .setDescription(`Total: ${warnings.length} | Active: ${activeWarnings.length} | Removed: ${inactiveWarnings.length}`);

        // Show active warnings
        for (const warning of activeWarnings.slice(0, 5)) {
            const moderator = await interaction.client.users.fetch(warning.moderatorId).catch((error) => { logger.warn(`Failed to fetch moderator ${warning.moderatorId} for warning display:`, error); return null; });
            embed.addFields({
                name: `Case #${warning.caseNumber} (Active)`,
                value: [
                    `**Reason:** ${warning.reason || 'No reason provided'}`,
                    `**By:** ${moderator?.tag || warning.moderatorId}`,
                    `**Date:** <t:${Math.floor(new Date(warning.createdAt).getTime() / 1000)}:R>`
                ].join('\n'),
                inline: false
            });
        }

        if (activeWarnings.length > 5) {
            embed.addFields({
                name: '...',
                value: `+ ${activeWarnings.length - 5} more active warnings`,
                inline: false
            });
        }

        embed.setFooter({ text: `User ID: ${target.id}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logger.error('Error fetching warnings:', error);
        await interaction.editReply('❌ Failed to fetch warnings.');
    }
}

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warning management commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        // Add subcommand
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Warn a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to warn')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for warning')
                        .setRequired(false)))
        // Remove subcommand
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a warning')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Remove all warnings for this user')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('warn_id')
                        .setDescription('Specific warning case number to remove')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('scope')
                        .setDescription('Remove all warnings for user')
                        .setRequired(false)
                        .addChoices(
                            { name: 'All warnings for user', value: 'all' }
                        )))
        // List subcommand
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List warnings for a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to view warnings for (default: yourself)')
                        .setRequired(false))),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'add':
                await handleWarn(interaction);
                break;
            case 'remove':
                await handleWarnRemove(interaction);
                break;
            case 'list':
                await handleWarnings(interaction);
                break;
            default:
                await interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
        }
    }
};

export default command;
