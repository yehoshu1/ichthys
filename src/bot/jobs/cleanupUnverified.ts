import cron from 'node-cron';
import client from '../client';
import logger from '../utils/logger';
import { db } from '../../shared/database/client';
import { guildConfig, userJoin, actionLog } from '../../shared/database/schema';
import { eq, and, isNull, lte } from 'drizzle-orm';

export default function startCleanupJob() {
    // Run every hour
    cron.schedule('0 * * * *', async () => {
        logger.info('Running cleanup job for unverified users...');
        try {
            const configs = await db.select().from(guildConfig).where(eq(guildConfig.verificationEnabled, true));

            for (const config of configs) {
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
                            }
                        } else {
                            // Member left guild?
                            await db.update(userJoin)
                                .set({ kickedAt: new Date() }) // Mark processed
                                .where(eq(userJoin.id, userRecord.id));
                        }
                    } catch (err) {
                        logger.error(`Error processing kick for user ${userRecord.userId}:`, err);
                    }
                }
            }
        } catch (error) {
            logger.error('Error in cleanupUnverified job:', error);
        }
    });
}
