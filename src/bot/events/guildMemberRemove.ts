import { Events, GuildMember, PartialGuildMember, TextChannel } from 'discord.js';
import type { Event } from '../types/Event';
import logger from '../utils/logger';
import { db } from '../../shared/database/client';
import { guildConfig, userJoin } from '../../shared/database/schema';
import { eq, and } from 'drizzle-orm';
import { buildMessage } from '../utils/embeds';
import { emitGuildNotificationSafe } from '../services/notificationEmitter';
import { sendLeaveMessage } from '../services/welcomeService';

const event: Event<Events.GuildMemberRemove> = {
    name: Events.GuildMemberRemove,
    async execute(member: GuildMember | PartialGuildMember) {
        try {
            // 1. Update database to track leave
            await db.update(userJoin)
                .set({
                    isVerified: false,
                    kickedAt: new Date(), // Using kickedAt to track leave time
                    updatedAt: new Date()
                })
                .where(and(
                    eq(userJoin.guildId, member.guild.id),
                    eq(userJoin.userId, member.id)
                ));

            logger.debug(`Updated leave record for ${member.user?.tag || member.id} in ${member.guild.name}`);

            // 2. NEW: Send leave message using new welcome system
            const leaveSent = await sendLeaveMessage(member as GuildMember);

            // 3. Legacy leave message (only if new system didn't send)
            if (!leaveSent) {
                const config = await db.query.guildConfig.findFirst({
                    where: eq(guildConfig.guildId, member.guild.id)
                });

                if (config && config.welcomeEnabled && config.leaveMessageChannelId) {
                    try {
                        const channel = await member.guild.channels.fetch(config.leaveMessageChannelId);
                        if (channel && channel.isTextBased()) {
                            const variables = {
                                'user': member.toString(),
                                'username': member.user?.username || 'Unknown',
                                'server': member.guild.name,
                                'memberCount': member.guild.memberCount.toString(),
                                'date': new Date().toLocaleDateString(),
                                'time': new Date().toLocaleTimeString(),
                            };

                            const messageData = buildMessage(
                                config.leaveMessage,
                                config.leaveMessageEmbed as any,
                                variables
                            );

                            if (messageData) {
                                await (channel as TextChannel).send(messageData);
                                logger.debug(`Sent legacy leave message for ${member.user?.tag || member.id} in ${member.guild.name}`);
                            }
                        }
                    } catch (msgError) {
                        logger.error(`Failed to send legacy leave message:`, msgError);
                        await emitGuildNotificationSafe({
                            guildId: member.guild.id,
                            eventType: 'WELCOME_LEAVE_MESSAGE_FAILED',
                            severity: 'ERROR',
                            source: 'BOT_EVENT',
                            title: `Failed to send leave message in ${member.guild.name}`,
                            body: msgError instanceof Error ? msgError.message : 'Unknown error',
                            targetUserId: member.id,
                            metadata: {
                                channelId: config.leaveMessageChannelId,
                            },
                            dedupeKey: `welcome-leave-message-failed:${config.leaveMessageChannelId ?? 'none'}`,
                            dedupeWindowSeconds: 600,
                        });
                    }
                }
            }

        } catch (error) {
            logger.error(`Error processing guildMemberRemove:`, error);
        }
    }
};

export default event;
