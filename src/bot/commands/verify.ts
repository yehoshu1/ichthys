import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { Command } from '../types/Command';
import { db } from '../../shared/database/client';
import { guildConfig, userJoin, verificationMessageRule } from '../../shared/database/schema';
import { eq, and } from 'drizzle-orm';
import logger from '../utils/logger';

export const verify: Command = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Manually verify a user')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to verify (mention or select)')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as any,

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const member = interaction.options.getMember('user') as GuildMember;
            const guildId = interaction.guildId;

            if (!guildId) {
                await interaction.editReply('This command can only be used in a server.');
                return;
            }

            if (!member) {
                await interaction.editReply('❌ Could not find that member in this server.');
                return;
            }

            // Fetch guild config
            const config = await db.query.guildConfig.findFirst({
                where: eq(guildConfig.guildId, guildId)
            });

            if (!config?.verificationEnabled) {
                await interaction.editReply('❌ Verification system is not enabled for this server.');
                return;
            }

            if (!config.verificationRoleId) {
                await interaction.editReply('❌ Verified role is not configured. Please configure it in the dashboard.');
                return;
            }

            // Check if already verified
            if (member.roles.cache.has(config.verificationRoleId)) {
                await interaction.editReply(`✅ ${member.user.username} is already verified.`);
                return;
            }

            // Remove unverified role if configured
            if (config.unverifiedRoleId && member.roles.cache.has(config.unverifiedRoleId)) {
                try {
                    await member.roles.remove(config.unverifiedRoleId);
                    logger.info(`Removed unverified role from ${member.user.tag}`);
                } catch (error) {
                    logger.error('Failed to remove unverified role:', error);
                    await interaction.editReply('❌ Failed to remove unverified role. Check bot permissions.');
                    return;
                }
            }

            // Add verified role
            try {
                await member.roles.add(config.verificationRoleId);
                logger.info(`Added verified role to ${member.user.tag}`);
            } catch (error) {
                logger.error('Failed to add verified role:', error);
                await interaction.editReply('❌ Failed to add verified role. Check bot permissions and role hierarchy.');
                return;
            }

            // Update database
            await db.update(userJoin)
                .set({
                    isVerified: true,
                    verifiedAt: new Date(),
                    updatedAt: new Date()
                })
                .where(and(
                    eq(userJoin.guildId, guildId),
                    eq(userJoin.userId, member.id)
                ));

            await interaction.editReply(
                `✅ Successfully verified **${member.user.username}**!\n` +
                `${config.unverifiedRoleId ? '- Removed unverified role\n' : ''}` +
                `- Added verified role`
            );

            // Determine which message to send
            let messageContent = config.verificationMessage;

            // Fetch role-based rules
            const rules = await db.query.verificationMessageRule.findMany({
                where: eq(verificationMessageRule.guildId, guildId)
            });

            // Check if user has any role that matches a rule
            for (const rule of rules) {
                if (member.roles.cache.has(rule.roleId)) {
                    messageContent = rule.message;
                    break; // Use the first matching rule
                }
            }

            // Send custom verification message if configured
            if (messageContent) {
                const finalMessage = messageContent.replace(/{user}/g, member.toString());

                try {
                    if (interaction.channel && interaction.channel.isSendable()) {
                        await interaction.channel.send(finalMessage);
                    }
                } catch (error) {
                    logger.error('Failed to send verification message:', error);
                    // Don't fail the command if message sending fails
                }
            }

            logger.info(`${interaction.user.tag} manually verified ${member.user.tag} in ${interaction.guild!.name}`);

        } catch (error) {
            logger.error('Error executing verify command:', error);
            await interaction.editReply('❌ An error occurred while verifying the user.');
        }
    },
};
