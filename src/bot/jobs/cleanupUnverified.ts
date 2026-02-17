import cron from 'node-cron';
import client from '../client';
import logger from '../utils/logger';
import { db } from '../../shared/database/client';
import { guildConfig, userJoin, actionLog } from '../../shared/database/schema';
import { eq, and, isNull, lte, gt } from 'drizzle-orm';
import { emitGuildNotificationSafe } from '../services/notificationEmitter';
import { isModuleEnabled } from '@shared/modules/state';

export default function startCleanupJob() {
    // Run every hour
    cron.schedule('0 * * * *', async () => {
        logger.info('Running cleanup job for unverified users...');
        try {
            const configs = await db.select().from(guildConfig).where(eq(guildConfig.verificationEnabled, true));

            for (const config of configs) {
                const verificationEnabled = await isModuleEnabled(config.guildId, 'verification');
                if (!verificationEnabled) continue;

                if (!config.verificationGraceDays) continue;

                // Calculate cutoff date
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - config.verificationGraceDays);

                // Find unverified users joined before cutoff
                const unverifiedUsers = await db.select()
                    .from(userJoin)
                    .where(and(
                        eq(userJoin.guildId, config.guildId),
                        eq(userJoin.isVerified, false),
                        isNull(userJoin.kickedAt),
                        lte(userJoin.joinedAt, cutoffDate)
                    ));

                const warningWindowEnd = new Date(cutoffDate.getTime() + (24 * 60 * 60 * 1000));
                const expiringSoonUsers = await db.select({
                    userId: userJoin.userId,
                })
                    .from(userJoin)
                    .where(and(
                        eq(userJoin.guildId, config.guildId),
                        eq(userJoin.isVerified, false),
                        isNull(userJoin.kickedAt),
                        gt(userJoin.joinedAt, cutoffDate),
                        lte(userJoin.joinedAt, warningWindowEnd)
                    ));

                if (expiringSoonUsers.length > 0) {
                    await emitGuildNotificationSafe({
                        guildId: config.guildId,
                        eventType: 'VERIFICATION_GRACE_EXPIRING',
                        severity: 'WARNING',
                        source: 'BOT_JOB',
                        title: `${expiringSoonUsers.length} unverified member(s) nearing grace deadline`,
                        metadata: {
                            count: expiringSoonUsers.length,
                            graceDays: config.verificationGraceDays,
                        },
                        dedupeKey: `verification-grace-expiring:${new Date().toISOString().slice(0, 10)}`,
                        dedupeWindowSeconds: 3600,
                    });
                }

                if (unverifiedUsers.length === 0) continue;

                const guild = client.guilds.cache.get(config.guildId);
                if (!guild) {
                    logger.warn(`Guild ${config.guildId} not found in cache during cleanup.`);
                    continue;
                }

                for (const userRecord of unverifiedUsers) {
                    try {
                        const member = await guild.members.fetch(userRecord.userId);
                        if (member) {
                            // SKIP BOTS
                            if (member.user.bot) continue;

                            if (config.verificationKickDmEnabled) {
                                try {
                                    await member.send(`You have been kicked from **${guild.name}** for failing to verify within ${config.verificationGraceDays} days.`);
                                } catch (e) {
                                    // Ignore DM errors
                                }
                            }

                            if (member.kickable) {
                                await member.kick(`Unverified for >${config.verificationGraceDays} days`);

                                // Update record
                                await db.update(userJoin)
                                    .set({ kickedAt: new Date() })
                                    .where(eq(userJoin.id, userRecord.id));

                                // Log action
                                await db.insert(actionLog).values({
                                    guildId: config.guildId,
                                    actionType: 'KICK',
                                    targetUserId: userRecord.userId,
                                    success: true,
                                    metadata: JSON.stringify({ reason: 'Unverified Auto-Kick' })
                                });

                                logger.info(`Kicked unverified user ${member.user.tag} from ${guild.name}`);
                                await emitGuildNotificationSafe({
                                    guildId: config.guildId,
                                    eventType: 'VERIFICATION_AUTO_KICK_SUCCESS',
                                    severity: 'WARNING',
                                    source: 'BOT_JOB',
                                    title: `Auto-kicked unverified member ${member.user.tag}`,
                                    targetUserId: userRecord.userId,
                                    metadata: {
                                        graceDays: config.verificationGraceDays,
                                    },
                                });
                            } else {
                                logger.warn(`Cannot kick ${member.user.tag} from ${guild.name} (missing permissions).`);
                                // Log failure
                                await db.insert(actionLog).values({
                                    guildId: config.guildId,
                                    actionType: 'KICK',
                                    targetUserId: userRecord.userId,
                                    success: false,
                                    errorMessage: 'Missing Permissions'
                                });
                                await emitGuildNotificationSafe({
                                    guildId: config.guildId,
                                    eventType: 'VERIFICATION_AUTO_KICK_FAILED',
                                    severity: 'ERROR',
                                    source: 'BOT_JOB',
                                    title: `Failed to auto-kick ${member.user.tag}`,
                                    body: 'Missing permissions',
                                    targetUserId: userRecord.userId,
                                    dedupeKey: `verification-auto-kick-failed:${userRecord.userId}`,
                                    dedupeWindowSeconds: 1800,
                                });
                            }
                        } else {
                            // Member left guild?
                            await db.update(userJoin)
                                .set({ kickedAt: new Date() }) // Mark processed
                                .where(eq(userJoin.id, userRecord.id));
                        }
                    } catch (err) {
                        logger.error(`Error processing kick for user ${userRecord.userId}:`, err);
                        await emitGuildNotificationSafe({
                            guildId: config.guildId,
                            eventType: 'VERIFICATION_AUTO_KICK_FAILED',
                            severity: 'ERROR',
                            source: 'BOT_JOB',
                            title: `Error auto-kicking user ${userRecord.userId}`,
                            body: err instanceof Error ? err.message : 'Unknown error',
                            targetUserId: userRecord.userId,
                            dedupeKey: `verification-auto-kick-failed:${userRecord.userId}`,
                            dedupeWindowSeconds: 1800,
                        });
                    }
                }
            }
        } catch (error) {
            logger.error('Error in cleanupUnverified job:', error);
        }
    });
}
