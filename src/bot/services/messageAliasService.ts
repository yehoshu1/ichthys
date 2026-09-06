import { eq, and } from 'drizzle-orm';
import { db } from '../../shared/database/client';
import { messageAlias, type MessageAlias, type NewMessageAlias } from '../../shared/database/schema';
import type { APIEmbed } from 'discord.js';
import logger from '../utils/logger';

/**
 * Maximum number of aliases per guild to prevent performance issues
 * This limit is enforced both at query time and with warnings
 */
const MAX_ALIASES_PER_GUILD = 100;

/**
 * Service for managing message aliases (auto-responders)
 */
export class MessageAliasService {
    /**
     * Get all message aliases for a guild
     */
    async getGuildAliases(guildId: string): Promise<MessageAlias[]> {
        return await db
            .select()
            .from(messageAlias)
            .where(eq(messageAlias.guildId, guildId))
            .limit(MAX_ALIASES_PER_GUILD);
    }

    /**
     * Get all enabled aliases for a guild (for the bot event handler)
     * 🎯 PERFORMANCE FIX: Added limit to prevent memory issues with large alias lists
     */
    async getEnabledAliases(guildId: string): Promise<MessageAlias[]> {
        const aliases = await db
            .select()
            .from(messageAlias)
            .where(and(
                eq(messageAlias.guildId, guildId),
                eq(messageAlias.enabled, true)
            ))
            .limit(MAX_ALIASES_PER_GUILD + 1); // Fetch one extra to detect if limit is exceeded

        // 🎯 PERFORMANCE FIX: Warn if guild has more aliases than the limit
        if (aliases.length > MAX_ALIASES_PER_GUILD) {
            logger.warn(
                `Guild ${guildId} has more than ${MAX_ALIASES_PER_GUILD} enabled aliases. ` +
                `Only the first ${MAX_ALIASES_PER_GUILD} will be processed. ` +
                `Consider removing unused aliases to improve performance.`
            );
            return aliases.slice(0, MAX_ALIASES_PER_GUILD);
        }

        return aliases;
    }

    /**
     * Get alias count for a guild (useful for checking limits)
     */
    async getGuildAliasCount(guildId: string): Promise<number> {
        const result = await db
            .select({ count: db.$count(messageAlias) })
            .from(messageAlias)
            .where(eq(messageAlias.guildId, guildId));

        return result[0]?.count || 0;
    }

    /**
     * Check if adding another alias would exceed the limit
     */
    async canAddAlias(guildId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
        const current = await this.getGuildAliasCount(guildId);
        return {
            allowed: current < MAX_ALIASES_PER_GUILD,
            current,
            limit: MAX_ALIASES_PER_GUILD
        };
    }

    /**
     * Get a specific alias by ID
     */
    async getAliasById(id: string): Promise<MessageAlias | null> {
        const [alias] = await db
            .select()
            .from(messageAlias)
            .where(eq(messageAlias.id, id))
            .limit(1);
        return alias || null;
    }

    /**
     * Get a specific alias by trigger word
     */
    async getAliasByTrigger(guildId: string, trigger: string): Promise<MessageAlias | null> {
        const [alias] = await db
            .select()
            .from(messageAlias)
            .where(and(
                eq(messageAlias.guildId, guildId),
                eq(messageAlias.trigger, trigger)
            ))
            .limit(1);
        return alias || null;
    }

    /**
     * Create a new message alias
     * 🎯 PERFORMANCE FIX: Check limit before creating
     */
    async createAlias(data: Omit<NewMessageAlias, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<MessageAlias | null> {
        // Check limit before creating
        const limitCheck = await this.canAddAlias(data.guildId);
        if (!limitCheck.allowed) {
            logger.warn(
                `Cannot create alias for guild ${data.guildId}: ` +
                `limit of ${MAX_ALIASES_PER_GUILD} aliases reached`
            );
            return null;
        }

        const [alias] = await db
            .insert(messageAlias)
            .values({
                ...data,
                usageCount: 0,
            })
            .returning();
        return alias;
    }

    /**
     * Update an existing message alias
     */
    async updateAlias(
        id: string,
        data: Partial<Omit<MessageAlias, 'id' | 'guildId' | 'createdAt' | 'updatedAt'>>
    ): Promise<MessageAlias | null> {
        const [updated] = await db
            .update(messageAlias)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(messageAlias.id, id))
            .returning();
        return updated || null;
    }

    /**
     * Delete a message alias
     */
    async deleteAlias(id: string): Promise<boolean> {
        const result = await db
            .delete(messageAlias)
            .where(eq(messageAlias.id, id))
            .returning({ id: messageAlias.id });
        return result.length > 0;
    }

    /**
     * Increment usage count for an alias
     */
    async incrementUsage(id: string): Promise<void> {
        await db
            .update(messageAlias)
            .set({
                usageCount: db.$count(messageAlias, eq(messageAlias.id, id)),
                updatedAt: new Date(),
            })
            .where(eq(messageAlias.id, id));
    }

    /**
     * Toggle alias enabled status
     */
    async toggleAlias(id: string): Promise<MessageAlias | null> {
        const alias = await this.getAliasById(id);
        if (!alias) return null;

        return await this.updateAlias(id, { enabled: !alias.enabled });
    }

    /**
     * Validate trigger format (alphanumeric, hyphens, underscores, max 50 chars)
     */
    validateTrigger(trigger: string): { valid: boolean; error?: string } {
        const trimmed = trigger.trim();

        if (!trimmed) {
            return { valid: false, error: 'Trigger cannot be empty' };
        }

        if (trimmed.length > 50) {
            return { valid: false, error: 'Trigger must be 50 characters or less' };
        }

        // Allow alphanumeric, hyphens, underscores, and common symbols
        const validPattern = /^[a-zA-Z0-9_\-\!\.\?\#\$\%]+$/;
        if (!validPattern.test(trimmed)) {
            return { valid: false, error: 'Trigger can only contain letters, numbers, and basic symbols' };
        }

        return { valid: true };
    }

    /**
     * Parse allowed channels from string
     */
    parseAllowedChannels(channels: string[] | string | null): string[] {
        if (!channels) return [];
        if (Array.isArray(channels)) return channels.filter(Boolean);
        return channels.split(',').map(id => id.trim()).filter(Boolean);
    }

    /**
     * Parse allowed roles from string
     */
    parseAllowedRoles(roles: string[] | string | null): string[] {
        if (!roles) return [];
        if (Array.isArray(roles)) return roles.filter(Boolean);
        return roles.split(',').map(id => id.trim()).filter(Boolean);
    }

    /**
     * Serialize channels array to string
     */
    serializeAllowedChannels(channels: string[]): string[] | null {
        if (channels.length === 0) return null;
        return channels;
    }

    /**
     * Serialize roles array to string
     */
    serializeAllowedRoles(roles: string[]): string[] | null {
        if (roles.length === 0) return null;
        return roles;
    }

    /**
     * Check if user can use an alias (channel and role restrictions)
     */
    canUseAlias(
        alias: MessageAlias,
        channelId: string,
        userRoles: string[]
    ): boolean {
        // Check channel restrictions
        const allowedChannels = this.parseAllowedChannels(alias.allowedChannels);
        if (allowedChannels.length > 0 && !allowedChannels.includes(channelId)) {
            return false;
        }

        // Check role restrictions
        const allowedRoles = this.parseAllowedRoles(alias.allowedRoles);
        if (allowedRoles.length > 0) {
            const hasAllowedRole = userRoles.some(role => allowedRoles.includes(role));
            if (!hasAllowedRole) {
                return false;
            }
        }

        return true;
    }

    /**
     * Validate and parse embed JSON
     */
    validateEmbed(embedStr: string): { valid: boolean; embed?: APIEmbed; error?: string } {
        try {
            const parsed = JSON.parse(embedStr) as APIEmbed;

            // Basic validation - ensure it has at least one property
            if (Object.keys(parsed).length === 0) {
                return { valid: false, error: 'Embed cannot be empty' };
            }

            // Validate color if present
            if (parsed.color !== undefined) {
                if (typeof parsed.color !== 'number' || parsed.color < 0 || parsed.color > 0xFFFFFF) {
                    return { valid: false, error: 'Embed color must be a valid hex number (0-16777215)' };
                }
            }

            return { valid: true, embed: parsed };
        } catch (e) {
            return { valid: false, error: 'Invalid JSON format' };
        }
    }
}

export const messageAliasService = new MessageAliasService();
