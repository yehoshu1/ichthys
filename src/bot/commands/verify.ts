import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { Command } from '../types/Command';
import { db } from '../../shared/database/client';
import { guildConfig, userJoin, verificationMessageRule, verificationRoleMessage, welcomeTrigger } from '../../shared/database/schema';
import { eq, and } from 'drizzle-orm';
import logger from '../utils/logger';
import { buildMessage } from '../utils/embeds';

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
        .addStringOption(option =>
            option
                .setName('profile')
                .setDescription('Additional verification profile to apply')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as any,

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const member = interaction.options.getMember('user') as GuildMember;
            const profileNameInput = interaction.options.getString('profile');
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

            const profiles = await db.query.verificationMessageRule.findMany({
                where: and(
                    eq(verificationMessageRule.guildId, guildId),
                    eq(verificationMessageRule.enabled, true)
                )
            });

            if (profileNameInput) {
                const lowerName = profileNameInput.toLowerCase();
                const profile = profiles.find((p) => {
                    if (p.name && p.name.toLowerCase() === lowerName) return true;
                    const roleName = interaction.guild!.roles.cache.get(p.roleId)?.name;
                    return roleName ? roleName.toLowerCase() === lowerName : false;
                });
                if (!profile) {
                    await interaction.editReply('❌ Verification profile not found. Check the profile name in the dashboard.');
                    return;
                }

                try {
                    await member.roles.add(profile.roleId);
                } catch (error) {
                    logger.error('Failed to add profile role:', error);
                    await interaction.editReply('❌ Failed to add the profile role. Check bot permissions and role hierarchy.');
                    return;
                }

                // Note: Notification channel message will be sent automatically by guildMemberUpdate event handler

                // Send the profile's welcome message in the channel where the user is verified,
                // unless a welcome trigger already handles messages for this role.
                if (profile.welcomeMessage) {
                    try {
                        const hasWelcomeTrigger = await db.query.welcomeTrigger.findFirst({
                            where: and(
                                eq(welcomeTrigger.guildId, guildId),
                                eq(welcomeTrigger.roleId, profile.roleId),
                                eq(welcomeTrigger.enabled, true)
                            )
                        });

                        if (!hasWelcomeTrigger && interaction.channel && interaction.channel.isSendable()) {
                            const variables = {
                                user: member.toString(),
                                username: member.user.username,
                                server: interaction.guild!.name,
                                memberCount: interaction.guild!.memberCount.toString()
                            };
                            const messageData = buildMessage(profile.welcomeMessage, null, variables);
                            if (messageData) {
                                await interaction.channel.send(messageData);
                            }
                        }
                    } catch (error) {
                        logger.error('Failed to send profile welcome message:', error);
                    }
                }

                const profileLabel = profile.name || interaction.guild!.roles.cache.get(profile.roleId)?.name || 'profile';
                await interaction.editReply(`✅ Applied verification profile **${profileLabel}** to ${member.user.username}.`);
                return;
            }

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
            const roleMessages = await db.query.verificationRoleMessage.findMany({
                where: and(
                    eq(verificationRoleMessage.guildId, guildId),
                    eq(verificationRoleMessage.enabled, true)
                )
            });
            const matchedRoleMessage = roleMessages.find(rule => member.roles.cache.has(rule.roleId)) || null;
            if (matchedRoleMessage) {
                messageContent = matchedRoleMessage.message;
            }

            // Send custom verification/notification message if configured, honoring welcome triggers
            const variables = {
                user: member.toString(),
                username: member.user.username,
                server: interaction.guild!.name,
                memberCount: interaction.guild!.memberCount.toString()
            };

            const roleToCheck = matchedRoleMessage ? matchedRoleMessage.roleId : config.verificationRoleId;
            const hasWelcomeTrigger = roleToCheck
                ? await db.query.welcomeTrigger.findFirst({
                    where: and(
                        eq(welcomeTrigger.guildId, guildId),
                        eq(welcomeTrigger.roleId, roleToCheck),
                        eq(welcomeTrigger.enabled, true)
                    )
                })
                : null;

            if (!hasWelcomeTrigger) {
                const messageData = buildMessage(
                    messageContent,
                    (matchedRoleMessage?.messageEmbed as any) || (config.verificationMessageEmbed as any) || null,
                    variables
                );

                if (messageData) {
                    try {
                        // Determine target channel: role-specific notifyChannel, then guild config channel, then current channel
                        const targetChannelId = (matchedRoleMessage && (matchedRoleMessage as any).notifyChannelId) || (config.verificationMessageChannelId as any) || null;
                        if (targetChannelId && interaction.guild) {
                            const target = interaction.guild.channels.cache.get(targetChannelId as string) as any;
                            if (target && typeof target.isTextBased === 'function' && target.isTextBased() && typeof target.isSendable === 'function' && target.isSendable()) {
                                await target.send(messageData);
                            } else if (interaction.channel && interaction.channel.isSendable()) {
                                await interaction.channel.send(messageData);
                            }
                        } else if (interaction.channel && interaction.channel.isSendable()) {
                            await interaction.channel.send(messageData);
                        }
                    } catch (error) {
                        logger.error('Failed to send verification message:', error);
                    }
                }
            }

            // Send welcome message in verification channel if configured (role-specific welcome overrides config)
            try {
                const welcomeText = (matchedRoleMessage && (matchedRoleMessage as any).welcomeMessage) || (config.verificationWelcomeMessage as any) || null;
                if (welcomeText && interaction.channel && interaction.channel.isSendable()) {
                    const welcomeHasTrigger = roleToCheck
                        ? await db.query.welcomeTrigger.findFirst({
                            where: and(
                                eq(welcomeTrigger.guildId, guildId),
                                eq(welcomeTrigger.roleId, roleToCheck),
                                eq(welcomeTrigger.enabled, true)
                            )
                        })
                        : null;

                    if (!welcomeHasTrigger) {
                        const welcomeData = buildMessage(welcomeText, null, variables);
                        if (welcomeData) {
                            await interaction.channel.send(welcomeData);
                        }
                    }
                }
            } catch (error) {
                logger.error('Failed to send verification welcome message:', error);
            }

            logger.info(`${interaction.user.tag} manually verified ${member.user.tag} in ${interaction.guild!.name}`);

        } catch (error) {
            logger.error('Error executing verify command:', error);
            await interaction.editReply('❌ An error occurred while verifying the user.');
        }
    },
    policy: {
        requiredBotPermissions: [PermissionFlagsBits.ManageRoles],
    },
};
