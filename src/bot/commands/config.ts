import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../types/Command';
import { db } from '../../shared/database/client';
import { guildConfig } from '../../shared/database/schema';
import { eq } from 'drizzle-orm';
import logger from '../utils/logger';

export const config: Command = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('View or update server configuration')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View current server configuration'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Toggle a feature on/off')
                .addStringOption(option =>
                    option.setName('feature')
                        .setDescription('Feature to toggle')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Welcome System', value: 'welcome' },
                            { name: 'Verification', value: 'verification' },
                            { name: 'Boost Rewards', value: 'boost' },
                            { name: 'Leveling', value: 'leveling' },
                            { name: 'Level-Up Notifications', value: 'levelup' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('sync')
                .setDescription('Sync existing members to database (Fixes analytics)')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId!;

        // Defer reply for all subcommands (database operations)
        await interaction.deferReply({ ephemeral: true });

        try {
            let dbConfig = await db.query.guildConfig.findFirst({
                where: eq(guildConfig.guildId, guildId)
            });

            if (!dbConfig) {
                // Create default config
                const [newConfig] = await db.insert(guildConfig).values({
                    guildId
                }).returning();
                dbConfig = newConfig;
            }

            if (subcommand === 'view') {
                const embed = new EmbedBuilder()
                    .setTitle('⚙️ Server Configuration')
                    .setColor('#5865F2')
                    .addFields(
                        {
                            name: '👋 Welcome System',
                            value: dbConfig.welcomeEnabled ? '✅ Enabled' : '❌ Disabled',
                            inline: true
                        },
                        {
                            name: '✔️ Verification',
                            value: dbConfig.verificationEnabled
                                ? `✅ Enabled (${dbConfig.verificationGraceDays} days)`
                                : '❌ Disabled',
                            inline: true
                        },
                        {
                            name: '🚀 Boost Rewards',
                            value: dbConfig.boostEnabled ? '✅ Enabled' : '❌ Disabled',
                            inline: true
                        },
                        {
                            name: '📊 Leveling',
                            value: dbConfig.levelingEnabled
                                ? `✅ Enabled (${dbConfig.textXpMin}-${dbConfig.textXpMax} XP)`
                                : '❌ Disabled',
                            inline: true
                        },
                        {
                            name: '🔔 Level-Up Notifications',
                            value: dbConfig.levelUpNotifEnabled ? '✅ Enabled' : '❌ Disabled',
                            inline: true
                        }
                    )
                    .setFooter({ text: 'Use /config toggle <feature> to change settings, or use the dashboard for full control.' });

                await interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'toggle') {
                const feature = interaction.options.getString('feature', true);

                let fieldName = '';
                let newValue = false;

                switch (feature) {
                    case 'welcome':
                        newValue = !dbConfig.welcomeEnabled;
                        await db.update(guildConfig)
                            .set({ welcomeEnabled: newValue, updatedAt: new Date() })
                            .where(eq(guildConfig.guildId, guildId));
                        fieldName = 'Welcome System';
                        break;
                    case 'verification':
                        newValue = !dbConfig.verificationEnabled;
                        await db.update(guildConfig)
                            .set({ verificationEnabled: newValue, updatedAt: new Date() })
                            .where(eq(guildConfig.guildId, guildId));
                        fieldName = 'Verification';
                        break;
                    case 'boost':
                        newValue = !dbConfig.boostEnabled;
                        await db.update(guildConfig)
                            .set({ boostEnabled: newValue, updatedAt: new Date() })
                            .where(eq(guildConfig.guildId, guildId));
                        fieldName = 'Boost Rewards';
                        break;
                    case 'leveling':
                        newValue = !dbConfig.levelingEnabled;
                        await db.update(guildConfig)
                            .set({ levelingEnabled: newValue, updatedAt: new Date() })
                            .where(eq(guildConfig.guildId, guildId));
                        fieldName = 'Leveling';
                        break;
                    case 'levelup':
                        newValue = !dbConfig.levelUpNotifEnabled;
                        await db.update(guildConfig)
                            .set({ levelUpNotifEnabled: newValue, updatedAt: new Date() })
                            .where(eq(guildConfig.guildId, guildId));
                        fieldName = 'Level-Up Notifications';
                        break;
                }

                await interaction.editReply({
                    content: `${newValue ? '✅' : '❌'} **${fieldName}** has been ${newValue ? 'enabled' : 'disabled'}.`
                });

            } else if (subcommand === 'sync') {
                try {
                    const guild = interaction.guild;
                    if (!guild) {
                        await interaction.editReply('Guild not found.');
                        return;
                    }

                    // Fetch all members (requires GuildMembers intent)
                    const members = await guild.members.fetch();
                    let syncedCount = 0;

                    // Import userJoin schema here to avoid circular deps if needed, 
                    // provided standard imports are used at top of file
                    const { userJoin } = await import('../../shared/database/schema');

                    for (const [, member] of members) {
                        if (member.user.bot) continue;

                        const isVerified = dbConfig.verificationRoleId
                            ? member.roles.cache.has(dbConfig.verificationRoleId)
                            : false;

                        const verifiedAt = isVerified ? new Date() : null; // Approximate if not known

                        await db.insert(userJoin)
                            .values({
                                guildId: guild.id,
                                userId: member.id,
                                joinedAt: member.joinedAt || new Date(),
                                isVerified: isVerified,
                                verifiedAt: verifiedAt,
                                updatedAt: new Date()
                            })
                            .onConflictDoUpdate({
                                target: [userJoin.guildId, userJoin.userId],
                                set: {
                                    isVerified: isVerified,
                                    // Don't overwrite verifiedAt if it exists, unless we are newly verifying
                                    updatedAt: new Date()
                                }
                            });
                        syncedCount++;
                    }

                    await interaction.editReply(`✅ Successfully synced **${syncedCount}** members to the database! Analytics should now be accurate.`);
                } catch (error) {
                    logger.error('Sync error:', error);
                    await interaction.editReply('❌ Failed to sync members. Ensure the bot has the "Server Members Intent" enabled in the Developer Portal.');
                }
            }

        } catch (error) {
            logger.error('Error in config command:', error);
            // Always deferred at the start, so always use editReply
            await interaction.editReply('An error occurred while processing the command.');
        }
    }
};
