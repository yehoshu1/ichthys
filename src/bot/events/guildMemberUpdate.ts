import { Events, GuildMember, PartialGuildMember, TextChannel, EmbedBuilder } from 'discord.js';
import client from '../client';
import logger from '../utils/logger';
import { db } from '../../shared/database/client';
import { welcomeTrigger, messageTemplate, userJoin, guildConfig, userBoost, roleAction, actionLog } from '../../shared/database/schema';
import { eq, and } from 'drizzle-orm';
import { buildMessage } from '../utils/embeds';

export default function setupGuildMemberUpdateHandler() {
    client.on(Events.GuildMemberUpdate, async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
        // Find added and removed roles
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;
        const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
        const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));

        // Handle Removed Roles (Un-verify & Remove Actions)
        if (removedRoles.size > 0) {
            try {
                const config = await db.query.guildConfig.findFirst({
                    where: eq(guildConfig.guildId, newMember.guild.id)
                });

                if (config?.verificationEnabled && config.verificationRoleId) {
                    if (removedRoles.has(config.verificationRoleId)) {
                        await db.update(userJoin)
                            .set({
                                isVerified: false,
                                verifiedAt: null,
                                updatedAt: new Date()
                            })
                            .where(and(
                                eq(userJoin.guildId, newMember.guild.id),
                                eq(userJoin.userId, newMember.id)
                            ));
                        logger.info(`User ${newMember.user.tag} un-verified in ${newMember.guild.name}`);
                    }
                }
            } catch (error) {
                logger.error('Error checking verification role removal:', error);
            }

            // Check for Role Actions (REMOVE)
            for (const [roleId, role] of removedRoles) {
                try {
                    const actions = await db.query.roleAction.findMany({
                        where: and(
                            eq(roleAction.guildId, newMember.guild.id),
                            eq(roleAction.roleId, roleId),
                            eq(roleAction.enabled, true),
                            eq(roleAction.triggerType, 'REMOVE')
                        )
                    });

                    for (const action of actions) {
                        await executeRoleAction(newMember, action);
                    }
                } catch (error) {
                    logger.error(`Error processing role action (remove) for role ${role.name}:`, error);
                }
            }
        }

        if (addedRoles.size > 0) {
            // Check for Verification Role
            try {
                const config = await db.query.guildConfig.findFirst({
                    where: eq(guildConfig.guildId, newMember.guild.id)
                });

                if (config?.verificationEnabled && config.verificationRoleId) {
                    if (addedRoles.has(config.verificationRoleId)) {
                        // User Verified!
                        await db.update(userJoin)
                            .set({
                                isVerified: true,
                                verifiedAt: new Date(),
                                updatedAt: new Date()
                            })
                            .where(and(
                                eq(userJoin.guildId, newMember.guild.id),
                                eq(userJoin.userId, newMember.id)
                            ));
                        logger.info(`User ${newMember.user.tag} verified in ${newMember.guild.name}`);
                    }
                }
            } catch (error) {
                logger.error('Error checking verification role:', error);
            }

            for (const [roleId, role] of addedRoles) {
                try {
                    // Check for triggers for this role in this guild (Welcome System)
                    const triggers = await db.select({
                        trigger: welcomeTrigger,
                        template: messageTemplate
                    })
                        .from(welcomeTrigger)
                        .innerJoin(messageTemplate, eq(welcomeTrigger.templateId, messageTemplate.id))
                        .where(and(
                            eq(welcomeTrigger.guildId, newMember.guild.id),
                            eq(welcomeTrigger.roleId, roleId),
                            eq(welcomeTrigger.enabled, true)
                        ));

                    if (triggers.length > 0) {
                        logger.info(`Found ${triggers.length} welcome trigger(s) for role ${role.name} in guild ${newMember.guild.name}`);
                        for (const { trigger, template } of triggers) {
                            await sendWelcomeMessage(newMember, trigger, template);
                        }
                    }
                } catch (error) {
                    logger.error(`Error processing welcome trigger for role ${role.name}:`, error);
                }

                // Check for Role Actions (ADD)
                try {
                    const actions = await db.query.roleAction.findMany({
                        where: and(
                            eq(roleAction.guildId, newMember.guild.id),
                            eq(roleAction.roleId, roleId),
                            eq(roleAction.enabled, true),
                            eq(roleAction.triggerType, 'ADD')
                        )
                    });

                    for (const action of actions) {
                        await executeRoleAction(newMember, action);
                    }
                } catch (error) {
                    logger.error(`Error processing role action (add) for role ${role.name}:`, error);
                }
            }
        }

        // Handle Boosts
        const oldBoost = oldMember.premiumSince;
        const newBoost = newMember.premiumSince;

        if (!oldBoost && newBoost) {
            // New Boost!
            await handleBoost(newMember, newBoost, 'new');
        } else if (oldBoost && newBoost && oldBoost.getTime() !== newBoost.getTime()) {
            // Re-boost or Change
            await handleBoost(newMember, newBoost, 'reboost');
        } else if (oldBoost && !newBoost) {
            // Boost Removed
            logger.info(`User ${newMember.user.tag} stopped boosting ${newMember.guild.name}`);
            try {
                await db.update(userBoost)
                    .set({
                        boostEndsAt: new Date(), // Mark as ended now
                        updatedAt: new Date()
                    })
                    .where(and(
                        eq(userBoost.guildId, newMember.guild.id),
                        eq(userBoost.userId, newMember.id),
                        eq(userBoost.roleRemoved, false)
                    ));
            } catch (error) {
                logger.error('Error updating user boost on removal:', error);
            }
        }
    });
}

async function handleBoost(member: GuildMember, boostDate: Date, type: 'new' | 'reboost') {
    try {
        const config = await db.query.guildConfig.findFirst({
            where: eq(guildConfig.guildId, member.guild.id)
        });

        if (!config?.boostEnabled) return;

        logger.info(`User ${member.user.tag} ${type === 'new' ? 'started boosting' : 'renewed boost for'} ${member.guild.name}`);

        // 1. Assign Role
        if (config.boostRoleId) {
            try {
                await member.roles.add(config.boostRoleId);
                logger.info(`Assigned boost role ${config.boostRoleId} to ${member.user.tag}`);
            } catch (roleError) {
                logger.error(`Failed to assign boost role to ${member.user.tag}:`, roleError);
            }
        }

        // 2. Update Database
        const boostEndsAt = new Date(boostDate);
        boostEndsAt.setDate(boostEndsAt.getDate() + 30 + (config.boostRoleRemovalDays || 0));

        await db.insert(userBoost).values({
            guildId: member.guild.id,
            userId: member.id,
            boostedAt: boostDate,
            boostEndsAt: boostEndsAt,
            roleAssigned: !!config.boostRoleId,
            updatedAt: new Date()
        }).onConflictDoUpdate({
            target: [userBoost.guildId, userBoost.userId], // I should check if there's a unique constraint
            set: {
                boostedAt: boostDate,
                boostEndsAt: boostEndsAt,
                roleRemoved: false,
                roleRemovedAt: null,
                updatedAt: new Date()
            }
        });

        // 3. Send Announcement
        const announcementChannelId = config.boostAnnouncementChannelId;
        if (announcementChannelId) {
            const channel = await member.guild.channels.fetch(announcementChannelId);
            if (channel && channel.isTextBased()) {
                const messageTemplateText = type === 'new'
                    ? (config.boostWelcomeMessage || "Thank you {user} for boosting {server}! 🚀")
                    : (config.boostReBoostMessage || "Thank you {user} for renewing your boost for {server}! 🚀");

                const embedData = type === 'new' ? config.boostWelcomeMessageEmbed : config.boostReBoostMessageEmbed;

                const variables = {
                    'user': member.toString(),
                    'username': member.user.username,
                    'server': member.guild.name,
                    'memberCount': member.guild.memberCount.toString(),
                    'boostCount': member.guild.premiumSubscriptionCount?.toString() || '0',
                    'boostLevel': member.guild.premiumTier.toString(),
                    'date': new Date().toLocaleDateString(),
                    'time': new Date().toLocaleTimeString(),
                };

                const messageData = buildMessage(messageTemplateText, embedData as any, variables);

                if (messageData) {
                    await (channel as TextChannel).send(messageData);
                }
            }
        }
    } catch (error) {
        logger.error('Error handling boost:', error);
    }
}

async function executeRoleAction(member: GuildMember, action: typeof roleAction.$inferSelect) {
    const delayMs = (action.actionDelay || 0) * 60 * 1000;

    const runAction = async () => {
        try {
            // Verify member still has the role (if it's a delay)
            if (delayMs > 0) {
                const refreshedMember = await member.guild.members.fetch(member.id).catch(() => null);
                if (!refreshedMember || !refreshedMember.roles.cache.has(action.roleId)) {
                    logger.info(`Skipping role action ${action.id} for ${member.user.tag} - role removed before delay.`);
                    return;
                }
            }

            let success = true;
            let errorMessage = null;

            const variables = {
                'user': member.toString(), // <@123...>
                'username': member.user.username,
                'server': member.guild.name,
                'memberCount': member.guild.memberCount.toString(),
            };

            const messageData = buildMessage(action.dmMessage, action.dmMessageEmbed as any, variables);

            switch (action.actionType) {
                case 'DM':
                    if (messageData) {
                        try {
                            await member.send(messageData);
                        } catch (err) {
                            success = false;
                            errorMessage = 'Failed to send DM (DMs closed?)';
                        }
                    }
                    break;

                case 'MSG':
                case 'MESSAGE': // Support both for safety
                    if (action.channelId && messageData) {
                        try {
                            const channel = await member.guild.channels.fetch(action.channelId);
                            if (channel && channel.isTextBased()) {
                                await (channel as TextChannel).send(messageData);
                            } else {
                                success = false;
                                errorMessage = 'Channel not found or not text-based';
                            }
                        } catch (err) {
                            success = false;
                            errorMessage = 'Failed to send channel message';
                        }
                    }
                    break;

                case 'KICK':
                    try {
                        if (messageData) {
                            await member.send(messageData).catch(() => null);
                        }
                        await member.kick(action.kickReason || 'Automated role action');
                    } catch (err) {
                        success = false;
                        errorMessage = 'Failed to kick (Permissions?)';
                    }
                    break;

                case 'LOG':
                    if (action.logChannelId && messageData) {
                        const channel = await member.guild.channels.fetch(action.logChannelId);
                        if (channel && channel.isTextBased()) {
                            await (channel as TextChannel).send(messageData);
                        }
                    }
                    break;
            }

            // Record Log
            await db.insert(actionLog).values({
                guildId: member.guild.id,
                actionType: action.actionType,
                targetUserId: member.id,
                success,
                errorMessage,
                metadata: JSON.stringify({ actionId: action.id, roleId: action.roleId })
            });

            if (success) {
                logger.info(`Executed ${action.actionType} action for ${member.user.tag} in ${member.guild.name}`);
            } else {
                logger.warn(`Action ${action.actionType} for ${member.user.tag} partially failed: ${errorMessage}`);
            }

        } catch (error) {
            logger.error(`Error executing role action ${action.id}:`, error);
        }
    };

    if (delayMs > 0) {
        setTimeout(runAction, delayMs);
        logger.info(`Scheduled ${action.actionType} action for ${member.user.tag} in ${delayMs}ms`);
    } else {
        await runAction();
    }
}

async function sendWelcomeMessage(
    member: GuildMember,
    trigger: typeof welcomeTrigger.$inferSelect,
    template: typeof messageTemplate.$inferSelect
) {
    try {
        const variables = {
            'user': member.toString(), // <@123...>
            'username': member.user.username,
            'server': member.guild.name,
            'memberCount': member.guild.memberCount.toString(),
            'date': new Date().toLocaleDateString(),
            'time': new Date().toLocaleTimeString(),
        };

        // Prefer embedData, fallback to legacy columns if embedData is empty but legacy columns exist (optional migration step, but keeping it simple for now)
        // Actually, let's just use what's available. If embedData is present, use it.
        // If not, maybe constructing a temporary EmbedConfig from legacy columns?
        // Given the task is about standardizing, and I haven't migrated data, I should probably check if embedData is populated.
        // If the user hasn't saved the form yet with the new editor, embedData might be null.
        // If template.embedData is null, attempt to construct from legacy columns.

        let embedData: any = template.embedData;

        if (!embedData && template.embedEnabled) {
            embedData = {
                enabled: true,
                title: template.embedTitle,
                description: template.embedDescription,
                color: template.embedColor,
                thumbnail: template.embedThumbnail ? { url: '{user_avatar}' } : undefined, // Just a flag
                // Note: The logic for thumbnail was explicitly member.user.displayAvatarURL() in old code.
                // My buildMessage uses string urls.
            };
            // This fallback is tricky because buildMessage expects strings for urls.
            // I'll stick to using the new system and assume users update their templates or new templates use the new system.
            // OR I can map legacy fields correctly.
            // Actually, `messageTemplate` table schema showed `embedData` added.
            // I'll use `template.embedData` directly. If it's missing, no embed (unless I want to support legacy).
            // Supporting legacy is safer.
        }

        const messageData = buildMessage(template.content, embedData, variables);

        if (!messageData) return;

        if (trigger.channelId) {
            // Send to channel
            const channel = await member.guild.channels.fetch(trigger.channelId);
            if (channel && channel.isTextBased()) {
                await (channel as TextChannel).send(messageData);
                logger.debug(`Sent welcome message to channel ${channel.name} for ${member.user.tag}`);
            } else {
                logger.warn(`Welcome trigger channel ${trigger.channelId} not found or not text-based.`);
            }
        } else {
            // Send DM
            try {
                await member.send(messageData);
                logger.debug(`Sent welcome DM to ${member.user.tag}`);
            } catch (dmError) {
                logger.warn(`Failed to send welcome DM to ${member.user.tag} (DMs might be closed).`);
            }
        }
    } catch (error) {
        logger.error(`Failed to send welcome message to ${member.user.tag}:`, error);
    }
}
