import { Events, GuildMember, PartialGuildMember, TextChannel } from 'discord.js';
import type { Event } from '../types/Event';
import logger from '../utils/logger';
import { db } from '../../shared/database/client';
import { welcomeTrigger, messageTemplate, userJoin, guildConfig, userBoost, roleAction, actionLog, verificationMessageRule, scheduledRoleAction } from '../../shared/database/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { buildMessage } from '../utils/embeds';
import { emitGuildNotificationSafe } from '../services/notificationEmitter';

// Deduplicate verification profile messages (prevent double-send within 5 seconds)
const recentProfileMessages = new Map<string, number>();
const DEDUPE_WINDOW_MS = 5000;

const event: Event<Events.GuildMemberUpdate> = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
        // Find added and removed roles
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;
        const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
        const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));
        const addedRoleIds = Array.from(addedRoles.keys());
        const removedRoleIds = Array.from(removedRoles.keys());
        let verificationConfig = null;
        let verificationProfiles: Array<typeof verificationMessageRule.$inferSelect> = [];

        try {
            verificationConfig = await db.query.guildConfig.findFirst({
                where: eq(guildConfig.guildId, newMember.guild.id)
            });

            verificationProfiles = await db.query.verificationMessageRule.findMany({
                where: and(
                    eq(verificationMessageRule.guildId, newMember.guild.id),
                    eq(verificationMessageRule.enabled, true)
                )
            });
        } catch (error) {
            logger.error('Error fetching verification configuration:', error);
        }

        // Handle Removed Roles (Un-verify & Remove Actions)
        if (removedRoles.size > 0) {
            try {
                if (verificationConfig?.verificationEnabled && verificationConfig.verificationRoleId) {
                    if (removedRoles.has(verificationConfig.verificationRoleId)) {
                        const stillVerified = newMember.roles.cache.has(verificationConfig.verificationRoleId);
                        if (!stillVerified) {
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
                            await emitGuildNotificationSafe({
                                guildId: newMember.guild.id,
                                eventType: 'VERIFICATION_USER_UNVERIFIED',
                                severity: 'WARNING',
                                source: 'BOT_EVENT',
                                title: `${newMember.user.tag} is no longer verified`,
                                targetUserId: newMember.id,
                                metadata: {
                                    userId: newMember.id,
                                },
                            });
                        }
                    }
                }
            } catch (error) {
                logger.error('Error checking verification role removal:', error);
            }

            // Check for Role Actions (REMOVE)
            if (removedRoleIds.length > 0) {
                try {
                    const removeActions = await db.query.roleAction.findMany({
                        where: and(
                            eq(roleAction.guildId, newMember.guild.id),
                            inArray(roleAction.roleId, removedRoleIds),
                            eq(roleAction.enabled, true),
                            eq(roleAction.triggerType, 'REMOVE')
                        )
                    });

                    const removeActionsByRole = new Map<string, Array<typeof roleAction.$inferSelect>>();
                    for (const action of removeActions) {
                        const current = removeActionsByRole.get(action.roleId) || [];
                        current.push(action);
                        removeActionsByRole.set(action.roleId, current);
                    }

                    for (const roleId of removedRoleIds) {
                        const role = removedRoles.get(roleId);
                        const actions = removeActionsByRole.get(roleId) || [];
                        for (const action of actions) {
                            if (!checkRequiredRoles(newMember, action)) continue;
                            await executeRoleAction(newMember, action);
                        }

                        if (actions.length > 0 && role) {
                            logger.debug(`Processed ${actions.length} remove action(s) for role ${role.name} in ${newMember.guild.name}`);
                        }
                    }
                } catch (error) {
                    logger.error('Error processing role actions (remove batch):', error);
                }
            }
        }

        if (addedRoles.size > 0) {
            // Check for Verification Role
            try {
                if (verificationConfig?.verificationEnabled && verificationConfig.verificationRoleId) {
                    if (addedRoles.has(verificationConfig.verificationRoleId)) {
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
                        await emitGuildNotificationSafe({
                            guildId: newMember.guild.id,
                            eventType: 'VERIFICATION_USER_VERIFIED',
                            severity: 'INFO',
                            source: 'BOT_EVENT',
                            title: `${newMember.user.tag} completed verification`,
                            targetUserId: newMember.id,
                            metadata: {
                                userId: newMember.id,
                            },
                        });
                    }
                }
            } catch (error) {
                logger.error('Error checking verification role:', error);
            }

            for (const profile of verificationProfiles) {
                if (addedRoles.has(profile.roleId)) {
                    // Deduplication check
                    const dedupeKey = `${newMember.guild.id}:${newMember.id}:${profile.id}`;
                    const now = Date.now();
                    const lastSent = recentProfileMessages.get(dedupeKey);
                    
                    if (lastSent && (now - lastSent) < DEDUPE_WINDOW_MS) {
                        logger.debug(`Skipping duplicate verification profile message for ${newMember.user.tag} (profile: ${profile.name || profile.roleId})`);
                        continue;
                    }
                    
                    recentProfileMessages.set(dedupeKey, now);
                    
                    // Clean up old entries
                    if (recentProfileMessages.size > 1000) {
                        const cutoff = now - DEDUPE_WINDOW_MS;
                        for (const [key, timestamp] of recentProfileMessages.entries()) {
                            if (timestamp < cutoff) {
                                recentProfileMessages.delete(key);
                            }
                        }
                    }
                    
                    try {
                        if (profile.notifyChannelId) {
                            const channel = await newMember.guild.channels.fetch(profile.notifyChannelId);
                            if (channel && channel.isTextBased()) {
                                const variables = {
                                    user: newMember.toString(),
                                    username: newMember.user.username,
                                    server: newMember.guild.name,
                                    memberCount: newMember.guild.memberCount.toString()
                                };

                                const messageData = buildMessage(
                                    profile.message,
                                    profile.messageEmbed as any,
                                    variables
                                );

                                if (messageData) {
                                    await (channel as TextChannel).send(messageData);
                                }
                            }
                        }
                        logger.info(`Applied verification profile ${profile.name || profile.roleId} to ${newMember.user.tag}`);
                    } catch (error) {
                        logger.error(`Failed to send profile verification message for ${newMember.user.tag}:`, error);
                        await emitGuildNotificationSafe({
                            guildId: newMember.guild.id,
                            eventType: 'VERIFICATION_PROFILE_MESSAGE_FAILED',
                            severity: 'ERROR',
                            source: 'BOT_EVENT',
                            title: `Verification profile message failed for ${newMember.user.tag}`,
                            body: error instanceof Error ? error.message : 'Unknown error',
                            targetUserId: newMember.id,
                            metadata: {
                                roleId: profile.roleId,
                                profileId: profile.id,
                            },
                            dedupeKey: `verification-profile-failed:${profile.id}:${newMember.id}`,
                            dedupeWindowSeconds: 1800,
                        });
                    }
                }
            }

            if (addedRoleIds.length > 0) {
                let triggersByRole = new Map<string, Array<{ trigger: typeof welcomeTrigger.$inferSelect; template: typeof messageTemplate.$inferSelect }>>();
                let addActionsByRole = new Map<string, Array<typeof roleAction.$inferSelect>>();

                try {
                    const triggerRows = await db.select({
                        trigger: welcomeTrigger,
                        template: messageTemplate
                    })
                        .from(welcomeTrigger)
                        .innerJoin(messageTemplate, eq(welcomeTrigger.templateId, messageTemplate.id))
                        .where(and(
                            eq(welcomeTrigger.guildId, newMember.guild.id),
                            inArray(welcomeTrigger.roleId, addedRoleIds),
                            eq(welcomeTrigger.enabled, true)
                        ));

                    for (const row of triggerRows) {
                        const current = triggersByRole.get(row.trigger.roleId) || [];
                        current.push(row);
                        triggersByRole.set(row.trigger.roleId, current);
                    }
                } catch (error) {
                    logger.error('Error loading welcome triggers for added roles:', error);
                }

                try {
                    const addActions = await db.query.roleAction.findMany({
                        where: and(
                            eq(roleAction.guildId, newMember.guild.id),
                            inArray(roleAction.roleId, addedRoleIds),
                            eq(roleAction.enabled, true),
                            eq(roleAction.triggerType, 'ADD')
                        )
                    });

                    for (const action of addActions) {
                        const current = addActionsByRole.get(action.roleId) || [];
                        current.push(action);
                        addActionsByRole.set(action.roleId, current);
                    }
                } catch (error) {
                    logger.error('Error loading role actions for added roles:', error);
                }

                for (const roleId of addedRoleIds) {
                    const role = addedRoles.get(roleId);
                    const triggers = triggersByRole.get(roleId) || [];
                    const actions = addActionsByRole.get(roleId) || [];

                    try {
                        for (const { trigger, template } of triggers) {
                            await sendWelcomeMessage(newMember, trigger, template);
                        }
                        if (triggers.length > 0 && role) {
                            logger.info(`Processed ${triggers.length} welcome trigger(s) for role ${role.name} in guild ${newMember.guild.name}`);
                            await emitGuildNotificationSafe({
                                guildId: newMember.guild.id,
                                eventType: 'WELCOME_TRIGGER_SENT',
                                severity: 'INFO',
                                source: 'BOT_EVENT',
                                title: `Sent ${triggers.length} welcome trigger(s) for ${newMember.user.tag}`,
                                targetUserId: newMember.id,
                                metadata: {
                                    roleId,
                                    triggerCount: triggers.length,
                                },
                            });
                        }
                    } catch (error) {
                        logger.error(`Error processing welcome triggers for role ${role?.name || roleId}:`, error);
                        await emitGuildNotificationSafe({
                            guildId: newMember.guild.id,
                            eventType: 'WELCOME_TRIGGER_FAILED',
                            severity: 'ERROR',
                            source: 'BOT_EVENT',
                            title: `Welcome trigger failed for role ${role?.name || roleId}`,
                            body: error instanceof Error ? error.message : 'Unknown error',
                            targetUserId: newMember.id,
                            metadata: {
                                roleId,
                            },
                            dedupeKey: `welcome-trigger-failed:${roleId}`,
                            dedupeWindowSeconds: 600,
                        });
                    }

                    try {
                        for (const action of actions) {
                            if (!checkRequiredRoles(newMember, action)) continue;
                            await executeRoleAction(newMember, action);
                        }
                    } catch (error) {
                        logger.error(`Error processing role actions (add) for role ${role?.name || roleId}:`, error);
                    }
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
            await emitGuildNotificationSafe({
                guildId: newMember.guild.id,
                eventType: 'BOOST_ENDED',
                severity: 'INFO',
                source: 'BOT_EVENT',
                title: `${newMember.user.tag} stopped boosting`,
                targetUserId: newMember.id,
                metadata: {
                    userId: newMember.id,
                },
            });
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
    }
};

/**
 * Checks whether a member satisfies the required role conditions for a role action.
 * - If no required roles are specified, the condition passes unconditionally (backward compatible).
 * - AND logic: the member must have ALL of the required roles.
 * - OR logic: the member must have AT LEAST ONE of the required roles.
 */
function checkRequiredRoles(member: GuildMember, action: typeof roleAction.$inferSelect): boolean {
    if (!action.requiredRoleIds || action.requiredRoleIds.length === 0) return true;
    if (action.requiredRoleLogic === 'OR') {
        return action.requiredRoleIds.some(roleId => member.roles.cache.has(roleId));
    }
    return action.requiredRoleIds.every(roleId => member.roles.cache.has(roleId));
}

async function handleBoost(member: GuildMember, boostDate: Date, type: 'new' | 'reboost') {
    try {
        const config = await db.query.guildConfig.findFirst({
            where: eq(guildConfig.guildId, member.guild.id)
        });

        if (!config?.boostEnabled) return;

        logger.info(`User ${member.user.tag} ${type === 'new' ? 'started boosting' : 'renewed boost for'} ${member.guild.name}`);
        await emitGuildNotificationSafe({
            guildId: member.guild.id,
            eventType: type === 'new' ? 'BOOST_STARTED' : 'BOOST_RENEWED',
            severity: 'INFO',
            source: 'BOT_EVENT',
            title: type === 'new'
                ? `${member.user.tag} started boosting`
                : `${member.user.tag} renewed boost`,
            targetUserId: member.id,
            metadata: {
                userId: member.id,
                boostType: type,
            },
        });

        // 1. Update Database
        const boostEndsAt = new Date(boostDate);
        boostEndsAt.setDate(boostEndsAt.getDate() + 30 + (config.boostRoleRemovalDays || 0));
        const now = new Date();
        const isNewBoost = type === 'new';

        await db.insert(userBoost).values({
            guildId: member.guild.id,
            userId: member.id,
            boostedAt: boostDate,
            boostEndsAt: boostEndsAt,
            roleAssigned: false,
            boostCountTotal: isNewBoost ? 1 : 0,
            updatedAt: now
        }).onConflictDoUpdate({
            target: [userBoost.guildId, userBoost.userId],
            set: {
                boostedAt: boostDate,
                boostEndsAt: boostEndsAt,
                roleRemoved: false,
                roleRemovedAt: null,
                boostCountTotal: isNewBoost ? sql`boost_count_total + 1` : sql`boost_count_total`,
                updatedAt: now
            }
        });

        // 2. Send Announcement
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
                            await member.send(messageData).catch((error) => { logger.warn(`Failed to send DM to ${member.user.tag} for KICK action:`, error); return null; });
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
                await emitGuildNotificationSafe({
                    guildId: member.guild.id,
                    eventType: 'ROLE_ACTION_EXECUTED',
                    severity: 'INFO',
                    source: 'BOT_EVENT',
                    title: `Role action ${action.actionType} executed for ${member.user.tag}`,
                    targetUserId: member.id,
                    metadata: {
                        actionId: action.id,
                        roleId: action.roleId,
                        actionType: action.actionType,
                    },
                });
            } else {
                logger.warn(`Action ${action.actionType} for ${member.user.tag} partially failed: ${errorMessage}`);
                await emitGuildNotificationSafe({
                    guildId: member.guild.id,
                    eventType: 'ROLE_ACTION_FAILED',
                    severity: 'ERROR',
                    source: 'BOT_EVENT',
                    title: `Role action ${action.actionType} failed for ${member.user.tag}`,
                    body: errorMessage,
                    targetUserId: member.id,
                    metadata: {
                        actionId: action.id,
                        roleId: action.roleId,
                        actionType: action.actionType,
                    },
                    dedupeKey: `role-action-failed:${action.id}:${member.id}`,
                    dedupeWindowSeconds: 900,
                });
            }

        } catch (error) {
            logger.error(`Error executing role action ${action.id}:`, error);
        }
    };

    if (delayMs > 0) {
        const executeAt = new Date(Date.now() + delayMs);
        await db.insert(scheduledRoleAction).values({
            guildId: member.guild.id,
            actionId: action.id,
            userId: member.id,
            executeAt,
            status: 'PENDING',
            updatedAt: new Date()
        });
        logger.info(`Queued ${action.actionType} action for ${member.user.tag} at ${executeAt.toISOString()}`);
        await emitGuildNotificationSafe({
            guildId: member.guild.id,
            eventType: 'ROLE_ACTION_QUEUED',
            severity: 'INFO',
            source: 'BOT_EVENT',
            title: `Role action ${action.actionType} queued for ${member.user.tag}`,
            targetUserId: member.id,
            metadata: {
                actionId: action.id,
                roleId: action.roleId,
                executeAt: executeAt.toISOString(),
            },
        });
        return;
    }

    await runAction();
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

        let embedData: any = template.embedData;

        if (!embedData && template.embedEnabled) {
            embedData = {
                enabled: true,
                title: template.embedTitle,
                description: template.embedDescription,
                color: template.embedColor,
                thumbnail: template.embedThumbnail ? { url: '{user_avatar}' } : undefined,
            };
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

export default event;
