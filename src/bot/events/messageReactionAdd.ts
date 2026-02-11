import { Events, MessageReaction, User, PartialMessageReaction, PartialUser, GuildMember, Role } from 'discord.js';
import type { Event } from '../types/Event';
import logger from '../utils/logger';
import { db } from '../../shared/database/client';
import { reactionRole } from '../../shared/database/schema';
import { eq, and } from 'drizzle-orm';
import { emitGuildNotificationSafe } from '../services/notificationEmitter';

function getPositiveIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * 🎯 PERFORMANCE FIX: Cache for reaction roles per message
 * This prevents repeated database queries for the same message
 */
interface ReactionRoleCacheEntry {
    roles: typeof reactionRole.$inferSelect[];
    expiresAt: number;
}

const reactionRoleCache = new Map<string, ReactionRoleCacheEntry>();
const REACTION_ROLE_CACHE_TTL_MS = 60_000; // 1 minute
const MAX_REACTION_ROLE_CACHE_ENTRIES = getPositiveIntEnv('MAX_REACTION_ROLE_CACHE_ENTRIES', 500);
const MAX_REACTION_ROLES_PER_MESSAGE = 50; // Reasonable limit

function getCacheKey(messageId: string): string {
    return messageId;
}

/**
 * 🎯 PERFORMANCE FIX: Fetch reaction roles with caching
 */
async function getReactionRolesForMessage(messageId: string): Promise<typeof reactionRole.$inferSelect[]> {
    const cacheKey = getCacheKey(messageId);
    const now = Date.now();

    // Check cache
    const cached = reactionRoleCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
        return cached.roles;
    }

    // Fetch from database with limit
    const roles = await db.query.reactionRole.findMany({
        where: and(
            eq(reactionRole.messageId, messageId),
            eq(reactionRole.enabled, true)
        ),
        limit: MAX_REACTION_ROLES_PER_MESSAGE
    });

    // 🎯 PERFORMANCE FIX: Cache management - LRU eviction
    if (reactionRoleCache.size >= MAX_REACTION_ROLE_CACHE_ENTRIES) {
        // Remove oldest 10% of entries
        const entries = Array.from(reactionRoleCache.entries())
            .sort((a, b) => a[1].expiresAt - b[1].expiresAt);
        const toRemove = Math.ceil(MAX_REACTION_ROLE_CACHE_ENTRIES * 0.1);
        for (let i = 0; i < toRemove; i++) {
            const [key] = entries[i] ?? [];
            if (key) reactionRoleCache.delete(key);
        }
    }

    reactionRoleCache.set(cacheKey, {
        roles,
        expiresAt: now + REACTION_ROLE_CACHE_TTL_MS
    });

    return roles;
}

/**
 * 🎯 PERFORMANCE FIX: Invalidate reaction role cache
 * Call this when reaction roles are modified
 */
export function invalidateReactionRoleCache(messageId: string): void {
    reactionRoleCache.delete(getCacheKey(messageId));
}

/**
 * Clear entire reaction role cache (useful for admin commands)
 */
export function clearReactionRoleCache(): void {
    reactionRoleCache.clear();
    logger.info('Reaction role cache cleared');
}

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
                ?? await reaction.message.guild.members.fetch(user.id).catch((error) => { logger.warn(`Failed to fetch member ${user.id} for reaction role:`, error); return null; });
            if (!member) {
                logger.warn(`Member ${user.id} not found in guild ${guildId} for reaction role`);
                await emitGuildNotificationSafe({
                    guildId,
                    eventType: 'REACTION_ROLE_CONFIG_BROKEN',
                    severity: 'WARNING',
                    source: 'BOT_EVENT',
                    title: `Reaction role member lookup failed`,
                    body: `Member ${user.id} not found while processing reaction role`,
                    targetUserId: user.id,
                    metadata: {
                        messageId,
                        emoji,
                        roleId: config.roleId,
                    },
                    dedupeKey: `reaction-role-config-broken:member:${guildId}:${messageId}:${emoji}`,
                    dedupeWindowSeconds: 1800,
                });
                return;
            }

            const role = reaction.message.guild.roles.cache.get(config.roleId)
                ?? await reaction.message.guild.roles.fetch(config.roleId).catch((error) => { logger.warn(`Failed to fetch role ${config.roleId} for reaction role:`, error); return null; });
            if (!role) {
                logger.warn(`Role ${config.roleId} not found for reaction role in guild ${guildId}`);
                await emitGuildNotificationSafe({
                    guildId,
                    eventType: 'REACTION_ROLE_CONFIG_BROKEN',
                    severity: 'WARNING',
                    source: 'BOT_EVENT',
                    title: `Reaction role configuration references missing role`,
                    body: `Role ${config.roleId} not found`,
                    targetUserId: user.id,
                    metadata: {
                        messageId,
                        emoji,
                        roleId: config.roleId,
                    },
                    dedupeKey: `reaction-role-config-broken:role:${guildId}:${messageId}:${emoji}`,
                    dedupeWindowSeconds: 1800,
                });
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
            if (reaction.message.guild) {
                await emitGuildNotificationSafe({
                    guildId: reaction.message.guild.id,
                    eventType: 'REACTION_ROLE_PROCESSING_ERROR',
                    severity: 'ERROR',
                    source: 'BOT_EVENT',
                    title: `Reaction role processing failed`,
                    body: error instanceof Error ? error.message : 'Unknown error',
                    targetUserId: user.id,
                    metadata: {
                        messageId: reaction.message.id,
                        emoji: reaction.emoji.id || reaction.emoji.name || null,
                    },
                    dedupeKey: `reaction-role-processing-error:${reaction.message.id}:${reaction.emoji.id || reaction.emoji.name || 'unknown'}`,
                    dedupeWindowSeconds: 900,
                });
            }
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
        await reaction.users.remove(member.id).catch((error) => { logger.warn(`Failed to remove reaction from user ${member.id}:`, error); return null; });
    } else {
        // Add the role
        await member.roles.add(role.id);

        // Handle exclusive roles if configured
        if (exclusiveRoleIds && exclusiveRoleIds.length > 0) {
            const rolesToRemove = exclusiveRoleIds.filter((id) => id !== role.id);
            for (const roleId of rolesToRemove) {
                if (member.roles.cache.has(roleId)) {
                    await member.roles.remove(roleId).catch((error) => { logger.warn(`Failed to remove exclusive role ${roleId} from user ${member.id}:`, error); return null; });
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
    // 🎯 PERFORMANCE FIX: Use cached reaction roles instead of querying database
    const otherReactionRoles = await getReactionRolesForMessage(reaction.message.id);

    const allExclusiveIds = new Set([
        ...(exclusiveRoleIds ?? []),
        ...otherReactionRoles.map(r => r.roleId).filter(id => id !== role.id)
    ]);

    // Remove all exclusive roles
    for (const roleId of allExclusiveIds) {
        if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId).catch((error) => { logger.warn(`Failed to remove exclusive role ${roleId} from user ${member.id} in UNIQUE handler:`, error); return null; });
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
