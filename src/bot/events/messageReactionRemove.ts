import { Events, MessageReaction, User, PartialMessageReaction, PartialUser } from 'discord.js';
import type { Event } from '../types/Event';
import logger from '../utils/logger';
import { db } from '../../shared/database/client';
import { reactionRole } from '../../shared/database/schema';
import { and, eq } from 'drizzle-orm';

const event: Event<Events.MessageReactionRemove> = {
    name: Events.MessageReactionRemove,
    async execute(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
        if (user.bot) return;

        try {
            if (reaction.partial) {
                await reaction.fetch();
            }

            if (reaction.message.partial) {
                await reaction.message.fetch();
            }

            if (!reaction.message.guild) return;

            const guild = reaction.message.guild;
            const emoji = reaction.emoji.id || reaction.emoji.name;
            if (!emoji) return;

            const config = await db.query.reactionRole.findFirst({
                where: and(
                    eq(reactionRole.guildId, guild.id),
                    eq(reactionRole.messageId, reaction.message.id),
                    eq(reactionRole.emoji, emoji),
                    eq(reactionRole.enabled, true)
                )
            });

            if (!config) return;
            if (config.type !== 'TOGGLE' && config.type !== 'UNIQUE') return;

            const member = guild.members.cache.get(user.id)
                ?? await guild.members.fetch(user.id).catch(() => null);
            if (!member) return;

            const role = guild.roles.cache.get(config.roleId)
                ?? await guild.roles.fetch(config.roleId).catch(() => null);
            if (!role) return;

            if (member.roles.cache.has(role.id)) {
                await member.roles.remove(role.id);
            }
        } catch (error) {
            logger.error('Error handling reaction role removal:', error);
        }
    }
};

export default event;
