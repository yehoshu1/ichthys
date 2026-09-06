import nodeCron from 'node-cron';
import { db } from '../../shared/database/client';
import { userBoost, guildConfig, actionLog } from '../../shared/database/schema';
import { eq, and, lt } from 'drizzle-orm';
import client from '../client';
import logger from '../utils/logger';
import { emitGuildNotificationSafe } from '../services/notificationEmitter';
import { isModuleEnabled } from '@shared/modules/state';

export function setupBoostCleanupJob() {
    // Run every day at 3:00 AM
    nodeCron.schedule('0 3 * * *', async () => {
        logger.info('Running boost cleanup job...');
        await cleanupExpiredBoosts();
    });
}

export async function cleanupExpiredBoosts() {
    try {
        const now = new Date();

        // Find all active boosts that have expired
        const expiredBoosts = await db.select()
            .from(userBoost)
            .where(and(
                lt(userBoost.boostEndsAt, now),
                eq(userBoost.roleAssigned, true),
                eq(userBoost.roleRemoved, false)
            ));

        logger.info(`Found ${expiredBoosts.length} expired boost(s) to process.`);

        for (const boost of expiredBoosts) {
            try {
                const boostsEnabled = await isModuleEnabled(boost.guildId, 'boosts');
                if (!boostsEnabled) continue;

                const guild = await client.guilds.fetch(boost.guildId);
                if (!guild) continue;

                const member = await guild.members.fetch(boost.userId).catch((error) => { logger.warn(`Failed to fetch member ${boost.userId} during boost cleanup:`, error); return null; });
                const config = await db.query.guildConfig.findFirst({
                    where: eq(guildConfig.guildId, boost.guildId)
                });

                if (!config) continue;

                // 1. Remove Role
                if (member && config.boostRoleId) {
                    try {
                        await member.roles.remove(config.boostRoleId);
                        logger.info(`Removed boost role from ${member.user.tag} in ${guild.name}`);
                        await emitGuildNotificationSafe({
                            guildId: boost.guildId,
                            eventType: 'BOOST_ROLE_REMOVED',
                            severity: 'WARNING',
                            source: 'BOT_JOB',
                            title: `Removed expired boost role from ${member.user.tag}`,
                            targetUserId: boost.userId,
                            metadata: {
                                roleId: config.boostRoleId,
                                boostId: boost.id,
                            },
                        });
                    } catch (roleError) {
                        logger.error(`Failed to remove boost role from ${member.user.id} in ${guild.id}:`, roleError);
                        await emitGuildNotificationSafe({
                            guildId: boost.guildId,
                            eventType: 'BOOST_ROLE_REMOVE_FAILED',
                            severity: 'ERROR',
                            source: 'BOT_JOB',
                            title: `Failed to remove expired boost role from ${member.user.tag}`,
                            body: roleError instanceof Error ? roleError.message : 'Unknown error',
                            targetUserId: boost.userId,
                            metadata: {
                                roleId: config.boostRoleId,
                                boostId: boost.id,
                            },
                            dedupeKey: `boost-role-remove-failed:${boost.id}`,
                            dedupeWindowSeconds: 1800,
                        });
                    }
                }

                // 2. Send DM if enabled
                if (member && config.boostRoleRemovalDmEnabled) {
                    try {
                        await member.send(`Your boost reward role in **${guild.name}** has been removed as your boost has expired. Thank you for your support! 💖`);
                    } catch (dmError) {
                        logger.debug(`Could not send boost removal DM to ${member.user.tag}`);
                    }
                }

                // 3. Update Database
                await db.update(userBoost)
                    .set({
                        roleRemoved: true,
                        roleRemovedAt: new Date(),
                        updatedAt: new Date()
                    })
                    .where(eq(userBoost.id, boost.id));

                // 4. Log Action
                await db.insert(actionLog).values({
                    guildId: boost.guildId,
                    actionType: 'BOOST_ROLE_REMOVED',
                    targetUserId: boost.userId,
                    success: true,
                    metadata: JSON.stringify({ boostId: boost.id })
                });

            } catch (innerError) {
                logger.error(`Error processing expired boost ${boost.id}:`, innerError);
            }
        }

        logger.info('Boost cleanup job completed.');
    } catch (error) {
        logger.error('Error in boost cleanup job:', error);
    }
}
