/**
 * Birthday Job Module
 * 
 * Scheduled jobs for birthday announcements and role management.
 * 
 * Jobs:
 * - checkBirthdays: Runs hourly to check for birthdays and send announcements
 * - removeExpiredBirthdayRoles: Runs daily to remove birthday roles after the day ends
 * 
 * These jobs are typically scheduled in the bot's main process using node-cron
 * or similar scheduling library.
 * 
 * @module jobs/checkBirthdays
 */

import { db } from '../../shared/database/client';
import { birthdayConfig, birthdayEntry, birthdayLog } from '../../shared/database/schema';
import { eq, and } from 'drizzle-orm';
import logger from '../utils/logger';
import { Client, TextChannel } from 'discord.js';
import { emitGuildNotificationSafe } from '../services/notificationEmitter';
import { isModuleEnabled } from '@shared/modules/state';

/**
 * Check for birthdays and send announcements
 * This job should be run hourly to check for birthdays at the configured hour
 */
export async function checkBirthdays(client: Client) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentDay = now.getDate();
    const currentHour = now.getHours();
    const currentYear = now.getFullYear();

    logger.info(`Checking birthdays for ${currentMonth}/${currentDay} at hour ${currentHour}`);

    try {
        // Get all enabled birthday configs
        const configs = await db.query.birthdayConfig.findMany({
            where: eq(birthdayConfig.enabled, true)
        });

        for (const config of configs) {
            try {
                const birthdaysEnabled = await isModuleEnabled(config.guildId, 'birthdays');
                if (!birthdaysEnabled) continue;

                // Check if it's the configured hour
                if (config.hourOfDay !== currentHour) {
                    continue;
                }

                // Get guild
                const guild = await client.guilds.fetch(config.guildId).catch((error) => { logger.warn(`Failed to fetch guild ${config.guildId} for birthday check:`, error); return null; });
                if (!guild) {
                    logger.warn(`Guild ${config.guildId} not found for birthday check`);
                    continue;
                }

                // Get channel
                if (!config.channelId) {
                    continue;
                }

                const channel = await guild.channels.fetch(config.channelId).catch((error) => { logger.warn(`Failed to fetch birthday channel ${config.channelId}:`, error); return null; });
                if (!channel || !channel.isTextBased()) {
                    logger.warn(`Birthday channel ${config.channelId} not found or not text-based`);
                    continue;
                }

                // Find birthdays for today
                const birthdayEntries = await db.query.birthdayEntry.findMany({
                    where: and(
                        eq(birthdayEntry.guildId, config.guildId),
                        eq(birthdayEntry.month, currentMonth),
                        eq(birthdayEntry.day, currentDay)
                    )
                });

                // Batch fetch members to avoid N+1 query pattern
                const memberIds = birthdayEntries
                    .filter(e => e.lastCelebratedYear !== currentYear)
                    .map(e => e.userId);
                
                // Fetch all members at once if possible
                let members: Map<string, any> = new Map();
                try {
                    // Try to fetch from cache first, then API
                    for (const id of memberIds) {
                        const cached = guild.members.cache.get(id);
                        if (cached) {
                            members.set(id, cached);
                        }
                    }
                    // Fetch remaining members from API in batch
                    const uncachedIds = memberIds.filter(id => !members.has(id));
                    if (uncachedIds.length > 0) {
                        const fetchedMembers = await guild.members.fetch({ user: uncachedIds });
                        for (const [id, member] of fetchedMembers) {
                            members.set(id, member);
                        }
                    }
                } catch (error) {
                    logger.warn(`Failed to batch fetch members for birthdays:`, error);
                }

                for (const entry of birthdayEntries) {
                    try {
                        // Check if already celebrated this year
                        if (entry.lastCelebratedYear === currentYear) {
                            logger.debug(`Already celebrated ${entry.userId} this year`);
                            continue;
                        }

                        // Get user from batch-fetched members
                        const member = members.get(entry.userId);
                        if (!member) {
                            logger.warn(`Member ${entry.userId} not found in guild ${config.guildId}`);
                            continue;
                        }

                        // Calculate age if year is provided
                        let age: number | null = null;
                        if (entry.year && config.showAge) {
                            age = currentYear - entry.year;
                        }

                        // Build message
                        let message = config.messageTemplate
                            .replace(/{user\.mention}/g, member.user.toString())
                            .replace(/{user\.username}/g, member.user.username)
                            .replace(/{user\.displayname}/g, member.displayName)
                            .replace(/{user\.nickname}/g, member.nickname || member.user.username)
                            .replace(/{user\.id}/g, member.user.id)
                            .replace(/{age}/g, age?.toString() || '')
                            .replace(/{server\.name}/g, guild.name)
                            .replace(/{server\.id}/g, guild.id)
                            .replace(/{server\.members}/g, guild.memberCount?.toString() || '0');

                        // Handle role mention
                        let content = message;
                        const allowedMentions: { parse: ('everyone' | 'roles' | 'users')[], roles?: string[] } = { parse: [] };
                        
                        if (config.mentionRoleId) {
                            if (config.mentionRoleId === 'everyone') {
                                content = `@everyone ${message}`;
                                allowedMentions.parse = ['everyone'];
                            } else if (config.mentionRoleId === 'here') {
                                content = `@here ${message}`;
                                allowedMentions.parse = ['everyone']; // 'here' uses same parse type
                            } else {
                                // Specific role mention
                                content = `<@&${config.mentionRoleId}> ${message}`;
                                allowedMentions.parse = ['roles'];
                                allowedMentions.roles = [config.mentionRoleId];
                            }
                        }

                        // Send birthday message
                        let messageSent = false;
                        try {
                            await (channel as TextChannel).send({
                                content,
                                allowedMentions
                            });
                            messageSent = true;
                            logger.info(`Sent birthday message for ${member.user.tag} in ${guild.name}`);
                            await emitGuildNotificationSafe({
                                guildId: config.guildId,
                                eventType: 'BIRTHDAY_ANNOUNCEMENT_SENT',
                                severity: 'INFO',
                                source: 'BOT_JOB',
                                title: `Birthday announcement sent for ${member.user.tag}`,
                                targetUserId: member.id,
                                metadata: {
                                    birthdayEntryId: entry.id,
                                    channelId: config.channelId,
                                },
                            });
                        } catch (sendError) {
                            logger.error(`Failed to send birthday message for ${member.user.tag}:`, sendError);
                            await emitGuildNotificationSafe({
                                guildId: config.guildId,
                                eventType: 'BIRTHDAY_ANNOUNCEMENT_FAILED',
                                severity: 'ERROR',
                                source: 'BOT_JOB',
                                title: `Birthday announcement failed for ${member.user.tag}`,
                                body: sendError instanceof Error ? sendError.message : 'Unknown error',
                                targetUserId: member.id,
                                metadata: {
                                    birthdayEntryId: entry.id,
                                    channelId: config.channelId,
                                },
                                dedupeKey: `birthday-announcement-failed:${entry.id}`,
                                dedupeWindowSeconds: 3600,
                            });
                        }

                        // Assign birthday role if configured
                        let roleAssigned = false;
                        if (config.roleId) {
                            try {
                                const role = await guild.roles.fetch(config.roleId);
                                if (role && member.manageable) {
                                    await member.roles.add(role, 'Birthday celebration');
                                    roleAssigned = true;
                                    logger.info(`Assigned birthday role to ${member.user.tag}`);
                                    await emitGuildNotificationSafe({
                                        guildId: config.guildId,
                                        eventType: 'BIRTHDAY_ROLE_ASSIGNED',
                                        severity: 'INFO',
                                        source: 'BOT_JOB',
                                        title: `Birthday role assigned to ${member.user.tag}`,
                                        targetUserId: member.id,
                                        metadata: {
                                            roleId: config.roleId,
                                            birthdayEntryId: entry.id,
                                        },
                                    });
                                }
                            } catch (roleError) {
                                logger.error(`Failed to assign birthday role to ${member.user.tag}:`, roleError);
                                await emitGuildNotificationSafe({
                                    guildId: config.guildId,
                                    eventType: 'BIRTHDAY_ROLE_ASSIGN_FAILED',
                                    severity: 'WARNING',
                                    source: 'BOT_JOB',
                                    title: `Birthday role assignment failed for ${member.user.tag}`,
                                    body: roleError instanceof Error ? roleError.message : 'Unknown error',
                                    targetUserId: member.id,
                                    metadata: {
                                        roleId: config.roleId,
                                        birthdayEntryId: entry.id,
                                    },
                                    dedupeKey: `birthday-role-assign-failed:${entry.id}`,
                                    dedupeWindowSeconds: 3600,
                                });
                            }
                        }

                        // Update last celebrated year
                        await db.update(birthdayEntry)
                            .set({ lastCelebratedYear: currentYear })
                            .where(eq(birthdayEntry.id, entry.id));

                        // Log the birthday celebration
                        await db.insert(birthdayLog).values({
                            guildId: config.guildId,
                            userId: entry.userId,
                            celebratedAt: now,
                            messageSent,
                            roleAssigned,
                        });

                    } catch (entryError) {
                        logger.error(`Error processing birthday for ${entry.userId}:`, entryError);
                    }
                }
            } catch (configError) {
                logger.error(`Error processing birthday config for guild ${config.guildId}:`, configError);
            }
        }
    } catch (error) {
        logger.error('Error in birthday check job:', error);
    }
}

/**
 * Remove expired birthday roles
 * This should be run once daily after midnight to remove birthday roles from previous day
 */
export async function removeExpiredBirthdayRoles(client: Client) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayMonth = yesterday.getMonth() + 1;
    const yesterdayDay = yesterday.getDate();

    logger.info(`Removing expired birthday roles for ${yesterdayMonth}/${yesterdayDay}`);

    try {
        // Get all configs with auto-remove enabled
        const configs = await db.query.birthdayConfig.findMany({
            where: and(
                eq(birthdayConfig.enabled, true),
                eq(birthdayConfig.autoRemoveRole, true)
            )
        });

        for (const config of configs) {
            if (!config.roleId) continue;

            try {
                const birthdaysEnabled = await isModuleEnabled(config.guildId, 'birthdays');
                if (!birthdaysEnabled) continue;

                const guild = await client.guilds.fetch(config.guildId).catch((error) => { logger.warn(`Failed to fetch guild ${config.guildId} for birthday role removal:`, error); return null; });
                if (!guild) continue;

                // Find yesterday's birthdays
                const yesterdayBirthdays = await db.query.birthdayEntry.findMany({
                    where: and(
                        eq(birthdayEntry.guildId, config.guildId),
                        eq(birthdayEntry.month, yesterdayMonth),
                        eq(birthdayEntry.day, yesterdayDay)
                    )
                });

                for (const entry of yesterdayBirthdays) {
                    try {
                        const member = await guild.members.fetch(entry.userId).catch((error) => { logger.warn(`Failed to fetch member ${entry.userId} for birthday celebration:`, error); return null; });
                        if (!member) continue;

                        // Check if member has the birthday role
                        if (member.roles.cache.has(config.roleId!)) {
                            await member.roles.remove(config.roleId!, 'Birthday celebration ended');
                            logger.info(`Removed birthday role from ${member.user.tag}`);
                            await emitGuildNotificationSafe({
                                guildId: config.guildId,
                                eventType: 'BIRTHDAY_ROLE_REMOVED',
                                severity: 'INFO',
                                source: 'BOT_JOB',
                                title: `Birthday role removed from ${member.user.tag}`,
                                targetUserId: member.id,
                                metadata: {
                                    roleId: config.roleId,
                                    birthdayEntryId: entry.id,
                                },
                            });
                        }
                    } catch (memberError) {
                        logger.error(`Error removing role from ${entry.userId}:`, memberError);
                        await emitGuildNotificationSafe({
                            guildId: config.guildId,
                            eventType: 'BIRTHDAY_ROLE_REMOVE_FAILED',
                            severity: 'WARNING',
                            source: 'BOT_JOB',
                            title: `Birthday role removal failed for user ${entry.userId}`,
                            body: memberError instanceof Error ? memberError.message : 'Unknown error',
                            targetUserId: entry.userId,
                            metadata: {
                                roleId: config.roleId,
                                birthdayEntryId: entry.id,
                            },
                            dedupeKey: `birthday-role-remove-failed:${entry.id}`,
                            dedupeWindowSeconds: 3600,
                        });
                    }
                }
            } catch (guildError) {
                logger.error(`Error processing guild ${config.guildId}:`, guildError);
            }
        }
    } catch (error) {
        logger.error('Error in remove expired birthday roles job:', error);
    }
}
