import { Events, MessageReaction, User, PartialMessageReaction, PartialUser, GuildMember, Role } from 'discord.js';
import type { Event } from '../types/Event';
import logger from '../utils/logger';
import { db } from '../../shared/database/client';
import { reactionRole } from '../../shared/database/schema';
import { eq, and } from 'drizzle-orm';

const event: Event<Events.MessageReactionAdd> = {
    name: Events.MessageReactionAdd,
    async execute(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
        // Ignore bot reactions
        if (user.bot) return;

        try {
            if (reaction.partial) {
                await reaction.fetch();
            }

            if (reaction.message.partial) {
                await reaction.message.fetch();
            }

            // Only handle guild messages
            if (!reaction.message.guild) return;

            const guildId = reaction.message.guild.id;
            const messageId = reaction.message.id;
            const emoji = reaction.emoji.id || reaction.emoji.name; // Custom emoji ID or unicode name

            if (!emoji) return;

            // Find reaction role configuration
            const config = await db.query.reactionRole.findFirst({
                where: and(
                    eq(reactionRole.guildId, guildId),
                    eq(reactionRole.messageId, messageId),
                    eq(reactionRole.emoji, emoji),
                    eq(reactionRole.enabled, true)
                )
            });

            if (!config) return; // No reaction role configured for this emoji

            const member = reaction.message.guild.members.cache.get(user.id)
                ?? await reaction.message.guild.members.fetch(user.id).catch(() => null);
            if (!member) {
                logger.warn(`Member ${user.id} not found in guild ${guildId} for reaction role`);
                return;
            }

            const role = reaction.message.guild.roles.cache.get(config.roleId)
                ?? await reaction.message.guild.roles.fetch(config.roleId).catch(() => null);
            if (!role) {
                logger.warn(`Role ${config.roleId} not found for reaction role in guild ${guildId}`);
                return;
            }

            // Handle different reaction role types
            switch (config.type) {
                case 'TOGGLE':
                    await handleToggle(member, role, reaction, config.exclusiveRoleIds);
                    break;
                case 'ADD_ONLY':
                    await handleAddOnly(member, role);
                    break;
                case 'REMOVE_ONLY':
                    await handleRemoveOnly(member, role);
                    break;
                case 'UNIQUE':
                    await handleUnique(member, role, reaction, config.exclusiveRoleIds);
                    break;
                default:
                    await handleToggle(member, role, reaction);
            }

            logger.debug(`Processed reaction role ${config.type} for user ${user.tag} in guild ${reaction.message.guild.name}`);
        } catch (error) {
            logger.error('Error handling reaction role:', error);
        }
    }
};

async function handleToggle(
    member: GuildMember,
    role: Role,
    reaction: MessageReaction | PartialMessageReaction,
    exclusiveRoleIds?: string[] | null
) {
    // If user already has the role, remove it
    if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role.id);
        await reaction.users.remove(member.id).catch(() => null);
    } else {
        // Add the role
        await member.roles.add(role.id);

        // Handle exclusive roles if configured
        if (exclusiveRoleIds && exclusiveRoleIds.length > 0) {
            const rolesToRemove = exclusiveRoleIds.filter((id) => id !== role.id);
            for (const roleId of rolesToRemove) {
                if (member.roles.cache.has(roleId)) {
                    await member.roles.remove(roleId).catch(() => null);
                }
            }
        }
    }
}

async function handleAddOnly(member: GuildMember, role: Role) {
    if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role.id);
    }
}

async function handleRemoveOnly(member: GuildMember, role: Role) {
    if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role.id);
    }
}

async function handleUnique(
    member: GuildMember,
    role: Role,
    reaction: MessageReaction | PartialMessageReaction,
    exclusiveRoleIds?: string[] | null
) {
    // Remove all exclusive roles first
    const exclusiveIds = exclusiveRoleIds ?? [];

    // Also find other reaction roles on the same message and treat them as exclusive
    const otherReactionRoles = await db.query.reactionRole.findMany({
        where: and(
            eq(reactionRole.messageId, reaction.message.id),
            eq(reactionRole.enabled, true)
        )
    });

    const allExclusiveIds = new Set([
        ...exclusiveIds,
        ...otherReactionRoles.map(r => r.roleId).filter(id => id !== role.id)
    ]);

    // Remove all exclusive roles
    for (const roleId of allExclusiveIds) {
        if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId).catch(() => null);
        }
    }

    // Remove other reactions from the user on this message
    try {
        const message = await reaction.message.fetch();
        for (const [otherEmoji, otherReaction] of message.reactions.cache) {
            if (otherEmoji !== reaction.emoji.toString()) {
                const otherUsers = await otherReaction.users.fetch();
                if (otherUsers.has(member.id)) {
                    await otherReaction.users.remove(member.id);
                }
            }
        }
    } catch (error) {
        logger.debug('Could not clean up other reactions:', error);
    }

    // Add the new role
    await member.roles.add(role.id);
}

export default event;
