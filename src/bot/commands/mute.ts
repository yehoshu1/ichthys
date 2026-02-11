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
    action: 'MUTE',
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
        active: true,
    }).returning();

    await emitGuildNotificationSafe({
        guildId,
        eventType: 'MOD_CASE_CREATED_MUTE',
        severity: 'WARNING',
        source: 'BOT_EVENT',
        title: `Mute case #${caseNumber} created`,
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
    muteType: string,
    reason?: string,
    duration?: number | null
) {
    const settings = await db.query.moderationSettings.findFirst({
        where: eq(moderationSettings.guildId, interaction.guildId!)
    });

    if (!settings?.logChannelId) return;

    const logChannel = interaction.guild?.channels.cache.get(settings.logChannelId);
    if (!logChannel?.isTextBased()) return;

    const embed: any = {
        color: 0x808080,
        title: `${muteType} Mute | Case #${caseNumber}`,
        fields: [
            { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
            { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
            { name: 'Reason', value: reason || 'No reason provided', inline: false },
        ],
        timestamp: new Date().toISOString(),
    };

    if (duration) {
        const formatted = duration < 60 ? `${duration}m` : duration < 1440 ? `${Math.floor(duration / 60)}h` : `${Math.floor(duration / 1440)}d`;
        embed.fields.push({ name: 'Duration', value: formatted, inline: true });
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

async function handleTextMute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true);
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || undefined;

    let duration: number | null = null;
    let expiresAt: Date | undefined;

    if (durationStr) {
        duration = parseDuration(durationStr);
        if (!duration) {
            await interaction.reply({
                content: '❌ Invalid duration format. Use format like: 10m, 1h, 1d',
                ephemeral: true
            });
            return;
        }
        expiresAt = new Date(Date.now() + duration * 60 * 1000);
    }

    const member = interaction.guild!.members.cache.get(target.id);
    if (!member) {
        await interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });
        return;
    }

    // Get mute role from settings
    const settings = await db.query.moderationSettings.findFirst({
        where: eq(moderationSettings.guildId, interaction.guildId!)
    });

    if (!settings?.muteRoleId) {
        await interaction.reply({
            content: '❌ No mute role configured. Please set up a mute role in the dashboard first.',
            ephemeral: true
        });
        return;
    }

    const muteRole = interaction.guild!.roles.cache.get(settings.muteRoleId);
    if (!muteRole) {
        await interaction.reply({
            content: '❌ Configured mute role not found. Please update the mute role in the dashboard.',
            ephemeral: true
        });
        return;
    }

    if (member.roles.cache.has(muteRole.id)) {
        await interaction.reply({ content: '❌ This user is already text muted.', ephemeral: true });
        return;
    }

    await interaction.deferReply();

    try {
        await member.roles.add(muteRole);

        const modCase = await createModCase(
            interaction.guildId!,
            target.id,
            interaction.user.id,
            'MUTE',
            `Text mute: ${reason || 'No reason'}`,
            duration,
            expiresAt
        );

        await sendModLog(interaction, target, modCase.caseNumber, 'Text', reason, duration);

        // DM the user
        try {
            const durationText = duration ? ` for ${duration < 60 ? `${duration}m` : duration < 1440 ? `${Math.floor(duration / 60)}h` : `${Math.floor(duration / 1440)}d`}` : '';
            await target.send(`🔇 You have been text-muted in ${interaction.guild!.name}${durationText}${reason ? `: ${reason}` : '.'}`);
        } catch {
            // Ignore DM errors
        }

        const durationText = duration ? ` for ${duration < 60 ? `${duration}m` : duration < 1440 ? `${Math.floor(duration / 60)}h` : `${Math.floor(duration / 1440)}d`}` : '';
        await interaction.editReply(`🔇 **${target.tag}** has been text-muted${durationText} (Case #${modCase.caseNumber})`);
    } catch (error) {
        logger.error('Error text-muting user:', error);
        await interaction.editReply('❌ Failed to text-mute user. Please check my permissions.');
    }
}

async function handleVoiceMute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true);
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || undefined;

    let duration: number | null = null;
    let expiresAt: Date | undefined;

    if (durationStr) {
        duration = parseDuration(durationStr);
        if (!duration) {
            await interaction.reply({
                content: '❌ Invalid duration format. Use format like: 10m, 1h, 1d',
                ephemeral: true
            });
            return;
        }
        expiresAt = new Date(Date.now() + duration * 60 * 1000);
    }

    const member = interaction.guild!.members.cache.get(target.id);
    if (!member) {
        await interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });
        return;
    }

    // Check if user is in a voice channel
    if (!member.voice.channel) {
        await interaction.reply({ content: '❌ This user is not in a voice channel.', ephemeral: true });
        return;
    }

    // Check if already voice muted
    if (member.voice.serverMute) {
        await interaction.reply({ content: '❌ This user is already voice muted.', ephemeral: true });
        return;
    }

    // Check if we can moderate this user
    if (!member.moderatable) {
        await interaction.reply({ 
            content: '❌ I cannot voice mute this user. They may have higher permissions than me.', 
            ephemeral: true 
        });
        return;
    }

    await interaction.deferReply();

    try {
        await member.voice.setMute(true, reason);

        const modCase = await createModCase(
            interaction.guildId!,
            target.id,
            interaction.user.id,
            'MUTE',
            `Voice mute: ${reason || 'No reason'}`,
            duration,
            expiresAt
        );

        await sendModLog(interaction, target, modCase.caseNumber, 'Voice', reason, duration);

        // DM the user
        try {
            const durationText = duration ? ` for ${duration < 60 ? `${duration}m` : duration < 1440 ? `${Math.floor(duration / 60)}h` : `${Math.floor(duration / 1440)}d`}` : '';
            await target.send(`🔇 You have been voice-muted in ${interaction.guild!.name}${durationText}${reason ? `: ${reason}` : '.'}`);
        } catch {
            // Ignore DM errors
        }

        const durationText = duration ? ` for ${duration < 60 ? `${duration}m` : duration < 1440 ? `${Math.floor(duration / 60)}h` : `${Math.floor(duration / 1440)}d`}` : '';
        await interaction.editReply(`🔇 **${target.tag}** has been voice-muted${durationText} (Case #${modCase.caseNumber})`);
    } catch (error) {
        logger.error('Error voice-muting user:', error);
        await interaction.editReply('❌ Failed to voice-mute user. Please check my permissions.');
    }
}

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mute a user from text or voice channels')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        // Text mute subcommand
        .addSubcommand(subcommand =>
            subcommand
                .setName('text')
                .setDescription('Mute a user from text channels using the configured mute role')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to mute')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('duration')
                        .setDescription('Mute duration (e.g., 10m, 1h, 1d)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for muting')
                        .setRequired(false)))
        // Voice mute subcommand
        .addSubcommand(subcommand =>
            subcommand
                .setName('voice')
                .setDescription('Mute a user from speaking in voice channels')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to mute')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('duration')
                        .setDescription('Mute duration (e.g., 10m, 1h, 1d)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for muting')
                        .setRequired(false))),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'text':
                await handleTextMute(interaction);
                break;
            case 'voice':
                await handleVoiceMute(interaction);
                break;
            default:
                await interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
        }
    }
};

export default command;
