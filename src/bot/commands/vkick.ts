import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types/Command';
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
        action: 'KICK',
        reason: reason ? `Voice kick: ${reason}` : 'Voice kick',
        active: false,
    }).returning();

    await emitGuildNotificationSafe({
        guildId,
        eventType: 'MOD_CASE_CREATED_KICK',
        severity: 'WARNING',
        source: 'BOT_EVENT',
        title: `Voice kick case #${caseNumber} created`,
        targetUserId: userId,
        actorUserId: moderatorId,
        metadata: {
            caseId: modCase.id,
            caseNumber,
            type: 'voice',
        },
    });

    return modCase;
}

async function sendModLog(
    interaction: ChatInputCommandInteraction,
    targetTag: string,
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
        color: 0xFF4500,
        title: `Voice Kick | Case #${caseNumber}`,
        fields: [
            { name: 'User', value: `${targetTag} (${targetId})`, inline: true },
            { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
            { name: 'Reason', value: reason || 'No reason provided', inline: false },
        ],
        timestamp: new Date().toISOString(),
    };

    await logChannel.send({ embeds: [embed] });
}

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('vkick')
        .setDescription('Disconnect a user from voice channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to disconnect from voice')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for voice kick')
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

        // Check if user is in voice channel
        if (!member.voice.channel) {
            await interaction.reply({ content: '❌ This user is not in a voice channel.', ephemeral: true });
            return;
        }

        // Check if we can move this user
        if (!member.manageable) {
            await interaction.reply({ 
                content: '❌ I cannot disconnect this user. They may have higher permissions than me.', 
                ephemeral: true 
            });
            return;
        }

        // Check if the command user can manage this user
        const commandMember = interaction.guild.members.cache.get(interaction.user.id);
        if (commandMember && member.roles.highest.position >= commandMember.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
            await interaction.reply({ 
                content: '❌ You cannot disconnect a user with equal or higher role than you.', 
                ephemeral: true 
            });
            return;
        }

        await interaction.deferReply();

        try {
            const voiceChannel = member.voice.channel;
            
            // Disconnect user
            await member.voice.disconnect(reason);

            // Create mod case
            const modCase = await createModCase(
                interaction.guildId!,
                targetUser.id,
                interaction.user.id,
                reason
            );

            await sendModLog(interaction, targetUser.tag, targetUser.id, modCase.caseNumber, reason);

            await interaction.editReply(`🔇 **${targetUser.tag}** has been disconnected from **${voiceChannel.name}** (Case #${modCase.caseNumber})`);
            logger.info(`${interaction.user.tag} voice-kicked ${targetUser.tag} from ${voiceChannel.name} in ${interaction.guild.name}`);

        } catch (error) {
            logger.error('Error voice kicking user:', error);
            await interaction.editReply('❌ Failed to disconnect user. Please check my permissions.');
        }
    }
};

export default command;
