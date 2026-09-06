import { Events, GuildMember, TextChannel } from 'discord.js';
import type { Event } from '../types/Event';
import logger from '../utils/logger';
import { db } from '../../shared/database/client';
import { userJoin, guildConfig } from '../../shared/database/schema';
import { eq, and } from 'drizzle-orm';
import { buildMessage } from '../utils/embeds';
import { emitGuildNotificationSafe } from '../services/notificationEmitter';
import { sendWelcomeMessage } from '../services/welcomeService';

const event: Event<Events.GuildMemberAdd> = {
    name: Events.GuildMemberAdd,
    async execute(member: GuildMember) {
        try {
            // 1. Track join in database
            const existing = await db.select()
                .from(userJoin)
                .where(and(
                    eq(userJoin.guildId, member.guild.id),
                    eq(userJoin.userId, member.id)
                ))
                .limit(1);

            if (existing.length > 0) {
                // Update existing record (rejoin)
                await db.update(userJoin)
                    .set({
                        joinedAt: new Date(),
                        isVerified: false,
                        verifiedAt: null,
                        kickedAt: null,
                        updatedAt: new Date()
                    })
                    .where(eq(userJoin.id, existing[0].id));

                logger.debug(`Updated join record for ${member.user.tag} in ${member.guild.name}`);
            } else {
                // Create new record
                await db.insert(userJoin).values({
                    guildId: member.guild.id,
                    userId: member.id,
                    joinedAt: new Date(),
                    isVerified: false
                });

                logger.debug(`Created join record for ${member.user.tag} in ${member.guild.name}`);
            }

            // 2. Fetch guild config for legacy welcome features
            const config = await db.query.guildConfig.findFirst({
                where: eq(guildConfig.guildId, member.guild.id)
            });

            // 3. Auto-assign role if configured (legacy system)
            if (config?.autoRoleId) {
                try {
                    await member.roles.add(config.autoRoleId);
                    logger.info(`Auto-assigned role ${config.autoRoleId} to ${member.user.tag} in ${member.guild.name}`);
                    await emitGuildNotificationSafe({
                        guildId: member.guild.id,
                        eventType: 'WELCOME_AUTO_ROLE_ASSIGNED',
                        severity: 'INFO',
                        source: 'BOT_EVENT',
                        title: `Auto-role assigned to ${member.user.tag}`,
                        targetUserId: member.id,
                        metadata: {
                            roleId: config.autoRoleId,
                        },
                    });
                } catch (roleError) {
                    logger.error(`Failed to auto-assign role to ${member.user.tag}:`, roleError);
                    await emitGuildNotificationSafe({
                        guildId: member.guild.id,
                        eventType: 'WELCOME_AUTO_ROLE_ASSIGN_FAILED',
                        severity: 'ERROR',
                        source: 'BOT_EVENT',
                        title: `Failed to auto-assign role to ${member.user.tag}`,
                        body: roleError instanceof Error ? roleError.message : 'Unknown error',
                        targetUserId: member.id,
                        metadata: {
                            roleId: config.autoRoleId,
                        },
                        dedupeKey: `welcome-auto-role-failed:${config.autoRoleId}`,
                        dedupeWindowSeconds: 600,
                    });
                }
            }

            // 4. 🆕 NEW: Send welcome message using new welcome system
            // This takes priority over legacy system if enabled
            const welcomeSent = await sendWelcomeMessage(member);

            // 5. Legacy welcome message (only if new system didn't send)
            if (!welcomeSent && config?.welcomeEnabled) {
                // Send join message if configured (legacy system)
                if (config.joinMessageChannelId) {
                    try {
                        const channel = await member.guild.channels.fetch(config.joinMessageChannelId);
                        if (channel && channel.isTextBased()) {
                            const variables = {
                                'user': member.toString(),
                                'username': member.user.username,
                                'server': member.guild.name,
                                'memberCount': member.guild.memberCount.toString(),
                                'date': new Date().toLocaleDateString(),
                                'time': new Date().toLocaleTimeString(),
                            };

                            const messageData = buildMessage(
                                config.joinMessage,
                                config.joinMessageEmbed as any,
                                variables
                            );

                            if (messageData) {
                                await (channel as TextChannel).send(messageData);
                                logger.debug(`Sent legacy join message for ${member.user.tag} in ${member.guild.name}`);
                            }
                        }
                    } catch (msgError) {
                        logger.error(`Failed to send join message for ${member.user.tag}:`, msgError);
                        await emitGuildNotificationSafe({
                            guildId: member.guild.id,
                            eventType: 'WELCOME_JOIN_MESSAGE_FAILED',
                            severity: 'ERROR',
                            source: 'BOT_EVENT',
                            title: `Failed to send join message for ${member.user.tag}`,
                            body: msgError instanceof Error ? msgError.message : 'Unknown error',
                            targetUserId: member.id,
                            metadata: {
                                channelId: config.joinMessageChannelId,
                            },
                            dedupeKey: `welcome-join-message-failed:${config.joinMessageChannelId ?? 'none'}`,
                            dedupeWindowSeconds: 600,
                        });
                    }
                }
            }

        } catch (error) {
            logger.error(`Error processing guildMemberAdd for ${member.user.tag}:`, error);
        }
    }
};

export default event;
