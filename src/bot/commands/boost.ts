import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { Command } from '../types/Command';
import { db } from '../../shared/database/client';
import { userBoost, guildConfig } from '../../shared/database/schema';
import { eq, and } from 'drizzle-orm';
import logger from '../utils/logger';

async function resolveInteractionMember(
    interaction: ChatInputCommandInteraction
): Promise<GuildMember | null> {
    if (!interaction.guild) {
        return null;
    }

    if (interaction.member instanceof GuildMember) {
        return interaction.member;
    }

    return interaction.guild.members.fetch(interaction.user.id).catch(() => null);
}

export const boost: Command = {
    data: new SlashCommandBuilder()
        .setName('boost')
        .setDescription('Manage boost rewards')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check your current boost status and rewards'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('claim')
                .setDescription('Claim your boost reward role'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Create or configure the boost reward role')
                .addStringOption(option =>
                    option
                        .setName('role_name')
                        .setDescription('Name for the reward role')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('primary_color')
                        .setDescription('Primary hex color (e.g. #FF6B6B)')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('secondary_color')
                        .setDescription('Secondary hex color for gradient (optional)')
                        .setRequired(false))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'setup') {
            await interaction.deferReply({ ephemeral: true });

            if (!interaction.guildId || !interaction.guild) {
                await interaction.editReply('This command can only be used in a server.');
                return;
            }

            const guildId = interaction.guildId;
            const guild = interaction.guild;
            const roleName = interaction.options.getString('role_name', true);
            const primaryColor = interaction.options.getString('primary_color', true);
            const secondaryColor = interaction.options.getString('secondary_color');

            const parseHex = (value: string) => {
                const cleaned = value.replace('#', '');
                if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
                return parseInt(cleaned, 16);
            };

            const colorValue = parseHex(primaryColor);
            if (colorValue === null) {
                await interaction.editReply('❌ Invalid primary color. Use a hex value like #FF6B6B.');
                return;
            }

            try {
                const existingConfig = await db.query.guildConfig.findFirst({
                    where: eq(guildConfig.guildId, guildId)
                });
                if (!existingConfig) {
                    await db.insert(guildConfig).values({ guildId }).returning();
                }

                let roleId = existingConfig?.boostRoleId || null;
                let role = roleId ? await guild.roles.fetch(roleId).catch((error) => { logger.warn(`Failed to fetch boost role ${roleId}:`, error); return null; }) : null;

                if (!role) {
                    role = await guild.roles.create({
                        name: roleName,
                        color: colorValue,
                        mentionable: false
                    });
                    roleId = role.id;
                } else {
                    await role.edit({
                        name: roleName,
                        color: colorValue
                    });
                }

                await db.update(guildConfig)
                    .set({
                        boostRoleId: roleId,
                        boostRoleName: roleName,
                        boostRoleColorPrimary: primaryColor,
                        boostRoleColorSecondary: secondaryColor || null,
                        boostClaimRequired: true,
                        updatedAt: new Date()
                    })
                    .where(eq(guildConfig.guildId, guildId));

                const embed = new EmbedBuilder()
                    .setTitle('✅ Boost reward configured')
                    .setColor(colorValue)
                    .setDescription(`Role **${roleName}** is ready for boosters to claim.`)
                    .addFields(
                        { name: 'Primary Color', value: primaryColor, inline: true },
                        { name: 'Secondary Color', value: secondaryColor || 'None (single color)', inline: true },
                        { name: 'Role', value: `<@&${roleId}>`, inline: true }
                    )
                    .setFooter({ text: secondaryColor ? 'Gradient colors saved. If enhanced styles are unavailable, primary color is used.' : 'Single color applied.' });

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                await interaction.editReply('❌ Failed to configure boost reward. Check bot role permissions.');
            }
            return;
        }

        if (subcommand === 'claim') {
            await interaction.deferReply({ ephemeral: true });

            if (!interaction.guildId || !interaction.guild) {
                await interaction.editReply('This command can only be used in a server.');
                return;
            }

            const guildId = interaction.guildId!;
            const guild = interaction.guild!;
            const member = await resolveInteractionMember(interaction);
            if (!member) {
                await interaction.editReply('Unable to verify your server membership. Please try again.');
                return;
            }
            const premiumRoleId = guild.roles.premiumSubscriberRole?.id;
            const hasBoost = member.premiumSinceTimestamp !== null
                || (premiumRoleId ? member.roles.cache.has(premiumRoleId) : false);

            if (!hasBoost) {
                await interaction.editReply('❌ You must be an active Server Booster to claim rewards.');
                return;
            }

            const config = await db.query.guildConfig.findFirst({
                where: eq(guildConfig.guildId, guildId)
            });

            if (!config?.boostRoleId) {
                await interaction.editReply('❌ Boost reward role is not configured. Ask an admin to run `/boost setup`.');
                return;
            }

            try {
                await member.roles.add(config.boostRoleId);
                const boostStart = member.premiumSince ? new Date(member.premiumSince) : new Date();
                const boostEndsAt = new Date(boostStart);
                boostEndsAt.setDate(boostEndsAt.getDate() + 30 + (config.boostRoleRemovalDays || 0));

                const existing = await db.query.userBoost.findFirst({
                    where: and(eq(userBoost.guildId, guildId), eq(userBoost.userId, member.id))
                });

                if (existing) {
                    await db.update(userBoost)
                        .set({ roleAssigned: true, updatedAt: new Date() })
                        .where(and(eq(userBoost.guildId, guildId), eq(userBoost.userId, member.id)));
                } else {
                    await db.insert(userBoost).values({
                        guildId,
                        userId: member.id,
                        boostedAt: boostStart,
                        boostEndsAt,
                        roleAssigned: true,
                        boostCountTotal: 1,
                        updatedAt: new Date()
                    });
                }
                await interaction.editReply(`✅ Reward claimed! You now have <@&${config.boostRoleId}>.`);
            } catch (error) {
                await interaction.editReply('❌ Failed to assign reward role. Check bot permissions.');
            }
            return;
        }

        if (subcommand === 'status') {
            if (!interaction.guildId || !interaction.guild) {
                await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
                return;
            }

            const guildId = interaction.guildId!;
            const userId = interaction.user.id;

            // Defer reply for database operations
            await interaction.deferReply({ ephemeral: true });

            try {
                const member = await resolveInteractionMember(interaction);
                if (!member) {
                    await interaction.editReply({ content: 'Unable to verify your server membership. Please try again.' });
                    return;
                }

                const config = await db.query.guildConfig.findFirst({
                    where: eq(guildConfig.guildId, guildId)
                });

                const boostRecord = await db.query.userBoost.findFirst({
                    where: and(
                        eq(userBoost.guildId, guildId),
                        eq(userBoost.userId, userId)
                    )
                });

                const isPremium = member.premiumSinceTimestamp !== null;
                const premiumSince = member.premiumSince;

                const embed = new EmbedBuilder()
                    .setTitle('🚀 Your Boost Status')
                    .setColor(isPremium ? '#F47FFF' : '#4F545C')
                    .setThumbnail(interaction.user.displayAvatarURL());

                if (isPremium) {
                    embed.addFields(
                        { name: 'Status', value: '✨ **Active Booster**', inline: true },
                        { name: 'Boosting Since', value: premiumSince ? `<t:${Math.floor(premiumSince.getTime() / 1000)}:R>` : 'Unknown', inline: true }
                    );

                    if (config?.boostRoleId) {
                        const hasRole = member.roles.cache.has(config.boostRoleId);
                        embed.addFields({
                            name: 'Reward Role',
                            value: hasRole ? `<@&${config.boostRoleId}> ✅` : `<@&${config.boostRoleId}> ⏳ (Pending)`,
                            inline: true
                        });
                    }

                    if (boostRecord) {
                        embed.addFields({
                            name: 'Reward Expires',
                            value: `<t:${Math.floor(boostRecord.boostEndsAt.getTime() / 1000)}:D>`,
                            inline: true
                        });
                    }
                } else {
                    embed.setDescription('You are not currently boosting this server.');

                    if (boostRecord && !boostRecord.roleRemoved) {
                        embed.addFields({
                            name: '⚠️ Grace Period',
                            value: `Your boost reward role will be removed <t:${Math.floor(boostRecord.boostEndsAt.getTime() / 1000)}:R>`,
                        });
                    }
                }

                const activeBoosts = isPremium ? 1 : 0;
                const totalBoosts = boostRecord?.boostCountTotal || 0;

                embed.addFields({
                    name: 'Your Boosts',
                    value: `Active: **${activeBoosts}**\nAll-time: **${totalBoosts}**`,
                    inline: false
                });

                // Server boost stats
                const guild = interaction.guild!;
                embed.addFields({
                    name: 'Server Stats',
                    value: `**Level:** ${guild.premiumTier}\n**Total Boosts:** ${guild.premiumSubscriptionCount || 0}`,
                    inline: false
                });

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                logger.error('Error checking boost status:', error);
                await interaction.editReply({ content: 'An error occurred while checking your boost status.' });
            }
        }
    },
    policy: {
        subcommandMemberPermissions: {
            setup: [PermissionFlagsBits.ManageGuild],
        },
        subcommandBotPermissions: {
            setup: [PermissionFlagsBits.ManageRoles],
            claim: [PermissionFlagsBits.ManageRoles],
        },
    }
};
