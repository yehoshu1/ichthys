import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, User } from 'discord.js';
import type { Command } from '../types/Command';
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
        action: 'UNMUTE',
        reason: reason || null,
        active: false,
    }).returning();

    await emitGuildNotificationSafe({
        guildId,
        eventType: 'MOD_CASE_CREATED_UNMUTE',
        severity: 'INFO',
        source: 'BOT_EVENT',
        title: `Unmute case #${caseNumber} created`,
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
    unmuteType: string,
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
        title: `${unmuteType} Unmute | Case #${caseNumber}`,
        fields: [
            { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
            { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
            { name: 'Reason', value: reason || 'No reason provided', inline: false },
        ],
        timestamp: new Date().toISOString(),
    };

    await logChannel.send({ embeds: [embed] });
}

async function handleTextUnmute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || undefined;

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
        await interaction.reply({ content: '❌ No mute role configured.', ephemeral: true });
        return;
    }

    const muteRole = interaction.guild!.roles.cache.get(settings.muteRoleId);
    if (!muteRole) {
        await interaction.reply({ content: '❌ Configured mute role not found.', ephemeral: true });
        return;
    }

    if (!member.roles.cache.has(muteRole.id)) {
        await interaction.reply({ content: '❌ This user is not text muted.', ephemeral: true });
        return;
    }

    await interaction.deferReply();

    try {
        await member.roles.remove(muteRole);

        // Deactivate active mute cases
        await db.update(moderationCase)
            .set({ active: false })
            .where(and(
                eq(moderationCase.guildId, interaction.guildId!),
                eq(moderationCase.userId, target.id),
                eq(moderationCase.action, 'MUTE'),
                eq(moderationCase.active, true)
            ));

        const modCase = await createModCase(
            interaction.guildId!,
            target.id,
            interaction.user.id,
            `Text unmute: ${reason || 'No reason'}`
        );

        await sendModLog(interaction, target, modCase.caseNumber, 'Text', reason);

        await interaction.editReply(`🔊 **${target.tag}** has been text-unmuted (Case #${modCase.caseNumber})`);
    } catch (error) {
        logger.error('Error text-unmuting user:', error);
        await interaction.editReply('❌ Failed to text-unmute user. Please check my permissions.');
    }
}

async function handleVoiceUnmute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || undefined;

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

    // Check if voice muted
    if (!member.voice.serverMute) {
        await interaction.reply({ content: '❌ This user is not voice muted.', ephemeral: true });
        return;
    }

    // Check if we can moderate this user
    if (!member.moderatable) {
        await interaction.reply({ 
            content: '❌ I cannot voice unmute this user. They may have higher permissions than me.', 
            ephemeral: true 
        });
        return;
    }

    await interaction.deferReply();

    try {
        await member.voice.setMute(false, reason);

        const modCase = await createModCase(
            interaction.guildId!,
            target.id,
            interaction.user.id,
            `Voice unmute: ${reason || 'No reason'}`
        );

        await sendModLog(interaction, target, modCase.caseNumber, 'Voice', reason);

        await interaction.editReply(`🔊 **${target.tag}** has been voice-unmuted (Case #${modCase.caseNumber})`);
    } catch (error) {
        logger.error('Error voice-unmuting user:', error);
        await interaction.editReply('❌ Failed to voice-unmute user. Please check my permissions.');
    }
}

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Unmute a user from text or voice channels')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        // Text unmute subcommand
        .addSubcommand(subcommand =>
            subcommand
                .setName('text')
                .setDescription('Unmute a user from text channels')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to unmute')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for unmuting')
                        .setRequired(false)))
        // Voice unmute subcommand
        .addSubcommand(subcommand =>
            subcommand
                .setName('voice')
                .setDescription('Unmute a user from voice channels')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to unmute')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for unmuting')
                        .setRequired(false))),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'text':
                await handleTextUnmute(interaction);
                break;
            case 'voice':
                await handleVoiceUnmute(interaction);
                break;
            default:
                await interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
        }
    }
};

export default command;
