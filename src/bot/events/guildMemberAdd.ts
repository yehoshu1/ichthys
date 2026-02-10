import { Events, GuildMember, TextChannel } from 'discord.js';
import type { Event } from '../types/Event';
import logger from '../utils/logger';
import { db } from '../../shared/database/client';
import { userJoin, guildConfig } from '../../shared/database/schema';
import { eq, and } from 'drizzle-orm';
import { buildMessage } from '../utils/embeds';

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

            // 2. Fetch guild config for welcome features
            const config = await db.query.guildConfig.findFirst({
                where: eq(guildConfig.guildId, member.guild.id)
            });

            if (!config || !config.welcomeEnabled) return;

            // 3. Auto-assign role if configured
            if (config.autoRoleId) {
                try {
                    await member.roles.add(config.autoRoleId);
                    logger.info(`Auto-assigned role ${config.autoRoleId} to ${member.user.tag} in ${member.guild.name}`);
                } catch (roleError) {
                    logger.error(`Failed to auto-assign role to ${member.user.tag}:`, roleError);
                }
            }

            // 4. Send join message if configured
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
                            logger.debug(`Sent join message for ${member.user.tag} in ${member.guild.name}`);
                        }
                    }
                } catch (msgError) {
                    logger.error(`Failed to send join message for ${member.user.tag}:`, msgError);
                }
            }

        } catch (error) {
            logger.error(`Error processing guildMemberAdd for ${member.user.tag}:`, error);
        }
    }
};

export default event;
