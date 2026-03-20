import { Events, Message, TextChannel } from 'discord.js';
import type { Event } from '../types/Event';
import logger from '../utils/logger';
import { db } from '../../shared/database/client';
import { guildConfig, levelProfile, messageActivity, messageAlias } from '../../shared/database/schema';
import { eq, and, sql } from 'drizzle-orm';
import { calculateLevel, checkAndAssignLevelRewards } from '../utils/leveling';
import { buildMessage } from '../utils/embeds';
import { messageAliasService } from '../services/messageAliasService';
import { sanitizeContent, sanitizeEmbed, validateEmbed } from '../utils/sanitize';
import { emitGuildNotificationSafe } from '../services/notificationEmitter';

function getPositiveIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const CONFIG_TTL_MS = 60_000;
const ACTIVITY_FLUSH_INTERVAL_MS = 5_000;
const ACTIVITY_CHUNK_SIZE = 50;
const MAX_CONFIG_CACHE_ENTRIES = 1_000;
const MAX_ALIAS_COOLDOWN_ENTRIES = getPositiveIntEnv('MAX_ALIAS_COOLDOWN_ENTRIES', 5_000);
const MAX_ACTIVITY_BUFFER_ENTRIES = getPositiveIntEnv('MAX_ACTIVITY_BUFFER_ENTRIES', 2_000);

type GuildConfigRow = typeof guildConfig.$inferSelect;

interface CachedConfig {
    config: GuildConfigRow | null;
    expiresAt: number;
}

interface BufferedActivity {
    guildId: string;
    hour: number;
    day: number;
    date: Date;
    count: number;
}

const configCache = new Map<string, CachedConfig>();
const activityBuffer = new Map<string, BufferedActivity>();
let flushTimer: NodeJS.Timeout | null = null;
let isFlushing = false;
let lastAliasCooldownCleanupAt = 0;

function pruneConfigCache(now: number): void {
    for (const [key, value] of configCache.entries()) {
        if (value.expiresAt <= now) {
            configCache.delete(key);
        }
    }

    if (configCache.size <= MAX_CONFIG_CACHE_ENTRIES) {
        return;
    }

    const entries = Array.from(configCache.entries()).sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const overflow = configCache.size - MAX_CONFIG_CACHE_ENTRIES;
    for (let i = 0; i < overflow; i += 1) {
        const [key] = entries[i] ?? [];
        if (key) {
            configCache.delete(key);
        }
    }
}

function ensureActivityFlushTimer(): void {
    if (flushTimer) return;

    flushTimer = setInterval(() => {
        void flushActivityBuffer();
    }, ACTIVITY_FLUSH_INTERVAL_MS);
}

function queueMessageActivity(guildId: string, timestamp: Date): void {
    const hour = timestamp.getHours();
    const day = timestamp.getDay();
    const dateFloor = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate());
    const key = `${guildId}:${dateFloor.toISOString()}:${hour}`;

    const existing = activityBuffer.get(key);
    if (existing) {
        existing.count += 1;
        return;
    }

    activityBuffer.set(key, {
        guildId,
        hour,
        day,
        date: dateFloor,
        count: 1,
    });

    if (activityBuffer.size <= MAX_ACTIVITY_BUFFER_ENTRIES) {
        return;
    }

    const oldestKey = activityBuffer.keys().next().value;
    if (oldestKey) {
        activityBuffer.delete(oldestKey);
    }
}

async function flushActivityBuffer(): Promise<void> {
    if (isFlushing || activityBuffer.size === 0) return;

    isFlushing = true;
    const entries = Array.from(activityBuffer.values());
    activityBuffer.clear();

    try {
        for (let i = 0; i < entries.length; i += ACTIVITY_CHUNK_SIZE) {
            const chunk = entries.slice(i, i + ACTIVITY_CHUNK_SIZE);
            await db.insert(messageActivity)
                .values(chunk.map((entry) => ({
                    guildId: entry.guildId,
                    hour: entry.hour,
                    day: entry.day,
                    date: entry.date,
                    messageCount: entry.count,
                    updatedAt: new Date(),
                })))
                .onConflictDoUpdate({
                    target: [messageActivity.guildId, messageActivity.date, messageActivity.hour],
                    set: {
                        messageCount: sql`message_activity.message_count + excluded.message_count`,
                        updatedAt: new Date(),
                    },
                });
        }
    } catch (error) {
        logger.error('Failed to flush message activity buffer:', error);
        for (const entry of entries) {
            const key = `${entry.guildId}:${entry.date.toISOString()}:${entry.hour}`;
            const existing = activityBuffer.get(key);
            if (existing) {
                existing.count += entry.count;
            } else {
                activityBuffer.set(key, entry);
            }
        }
    } finally {
        isFlushing = false;
    }
}

async function getGuildConfigCached(guildId: string): Promise<GuildConfigRow | null> {
    const now = Date.now();
    pruneConfigCache(now);
    const cached = configCache.get(guildId);

    if (cached && cached.expiresAt > now) {
        return cached.config;
    }

    const config = await db.query.guildConfig.findFirst({
        where: eq(guildConfig.guildId, guildId),
    });

    configCache.set(guildId, {
        config: config || null,
        expiresAt: now + CONFIG_TTL_MS,
    });

    return config || null;
}

// Cooldown tracking for message aliases (userId:aliasId -> timestamp)
const aliasCooldowns = new Map<string, number>();

function cleanupAliasCooldowns(now: number): void {
    // Run cleanup at most once per minute.
    if (now - lastAliasCooldownCleanupAt < 60_000 && aliasCooldowns.size <= MAX_ALIAS_COOLDOWN_ENTRIES) {
        return;
    }

    lastAliasCooldownCleanupAt = now;

    for (const [key, lastUsed] of aliasCooldowns.entries()) {
        if (now - lastUsed > 60 * 60 * 1000) {
            aliasCooldowns.delete(key);
        }
    }

    if (aliasCooldowns.size <= MAX_ALIAS_COOLDOWN_ENTRIES) {
        return;
    }

    const entries = Array.from(aliasCooldowns.entries()).sort((a, b) => a[1] - b[1]);
    const overflow = aliasCooldowns.size - MAX_ALIAS_COOLDOWN_ENTRIES;
    for (let i = 0; i < overflow; i += 1) {
        const [key] = entries[i] ?? [];
        if (key) {
            aliasCooldowns.delete(key);
        }
    }
}

/**
 * Check if user is on cooldown for an alias
 */
function isOnCooldown(userId: string, aliasId: string, cooldownSeconds: number): boolean {
    if (cooldownSeconds <= 0) return false;
    
    const key = `${userId}:${aliasId}`;
    const now = Date.now();
    cleanupAliasCooldowns(now);
    const lastUsed = aliasCooldowns.get(key);
    
    if (lastUsed && (now - lastUsed) < cooldownSeconds * 1000) {
        return true;
    }
    
    aliasCooldowns.set(key, now);
    return false;
}

/**
 * Process message aliases (auto-responders)
 */
async function processMessageAliases(message: Message): Promise<void> {
    if (!message.guild) return;
    
    try {
        const aliases = await messageAliasService.getEnabledAliases(message.guild.id);
        if (aliases.length === 0) return;
        
        const content = message.content.trim();
        const member = message.member;
        if (!member) return;
        
        for (const alias of aliases) {
            // Check if message matches the trigger
            const requirePrefix = alias.requirePrefix || '';
            const fullTrigger = requirePrefix + alias.trigger;
            
            let matches = false;
            if (alias.caseSensitive) {
                matches = content === fullTrigger || content.startsWith(fullTrigger + ' ');
            } else {
                const lowerContent = content.toLowerCase();
                const lowerTrigger = fullTrigger.toLowerCase();
                matches = lowerContent === lowerTrigger || lowerContent.startsWith(lowerTrigger + ' ');
            }
            
            if (!matches) continue;
            
            // Check cooldown
            if (isOnCooldown(message.author.id, alias.id, alias.cooldownSeconds)) {
                continue;
            }
            
            // Check channel restrictions
            if (alias.allowedChannels) {
                const allowedChannels = messageAliasService.parseAllowedChannels(alias.allowedChannels);
                if (allowedChannels.length > 0 && !allowedChannels.includes(message.channelId)) {
                    continue;
                }
            }
            
            // Check role restrictions
            if (alias.allowedRoles) {
                const allowedRoles = messageAliasService.parseAllowedRoles(alias.allowedRoles);
                if (allowedRoles.length > 0) {
                    const hasRole = member.roles.cache.some(role => allowedRoles.includes(role.id));
                    if (!hasRole) continue;
                }
            }
            
            // Delete trigger message if configured
            if (alias.deleteTrigger) {
                try {
                    await message.delete();
                } catch (error) {
                    logger.warn(`Failed to delete trigger message for alias ${alias.id}:`, error);
                }
            }
            
            // Send response
            try {
                const responseData: { content?: string; embeds?: object[] } = {};

                if (alias.response) {
                    // Sanitize the response content to prevent abuse
                    const sanitizedContent = sanitizeContent(alias.response);
                    responseData.content = sanitizedContent;
                }

                if (alias.responseEmbed) {
                    // Validate and sanitize embed before sending
                    if (validateEmbed(alias.responseEmbed)) {
                        const sanitizedEmbed = sanitizeEmbed(alias.responseEmbed);
                        responseData.embeds = [sanitizedEmbed as object];
                    } else {
                        logger.warn(`Invalid embed detected for alias ${alias.id}, skipping embed`);
                        await emitGuildNotificationSafe({
                            guildId: message.guild.id,
                            eventType: 'ALIAS_EMBED_INVALID',
                            severity: 'WARNING',
                            source: 'BOT_EVENT',
                            title: `Alias ${alias.trigger} has an invalid embed`,
                            targetUserId: message.author.id,
                            metadata: {
                                aliasId: alias.id,
                                trigger: alias.trigger,
                            },
                            dedupeKey: `alias-invalid-embed:${alias.id}`,
                            dedupeWindowSeconds: 3600,
                        });
                    }
                }

                if ((responseData.content || responseData.embeds) && message.channel.isTextBased() && !message.channel.isDMBased()) {
                    await message.channel.send(responseData);
                }
                
                // Increment usage count
                const [updatedAlias] = await db.update(messageAlias)
                    .set({ 
                        usageCount: sql`usage_count + 1`,
                        updatedAt: new Date()
                    })
                    .where(eq(messageAlias.id, alias.id))
                    .returning({
                        id: messageAlias.id,
                        usageCount: messageAlias.usageCount,
                        trigger: messageAlias.trigger,
                    });

                if (updatedAlias && updatedAlias.usageCount > 0 && updatedAlias.usageCount % 500 === 0) {
                    await emitGuildNotificationSafe({
                        guildId: message.guild.id,
                        eventType: 'ALIAS_HIGH_USAGE',
                        severity: 'INFO',
                        source: 'BOT_EVENT',
                        title: `Alias ${updatedAlias.trigger} reached ${updatedAlias.usageCount} uses`,
                        metadata: {
                            aliasId: updatedAlias.id,
                            usageCount: updatedAlias.usageCount,
                            trigger: updatedAlias.trigger,
                        },
                        dedupeKey: `alias-high-usage:${updatedAlias.id}:${updatedAlias.usageCount}`,
                        dedupeWindowSeconds: 86400,
                    });
                }
                
            } catch (error) {
                logger.error(`Failed to send alias response for ${alias.id}:`, error);
                await emitGuildNotificationSafe({
                    guildId: message.guild.id,
                    eventType: 'ALIAS_RESPONSE_FAILED',
                    severity: 'WARNING',
                    source: 'BOT_EVENT',
                    title: `Alias response failed for trigger ${alias.trigger}`,
                    body: error instanceof Error ? error.message : 'Unknown error',
                    targetUserId: message.author.id,
                    metadata: {
                        aliasId: alias.id,
                        trigger: alias.trigger,
                    },
                    dedupeKey: `alias-response-failed:${alias.id}`,
                    dedupeWindowSeconds: 600,
                });
            }
            
            // Only process the first matching alias
            break;
        }
    } catch (error) {
        logger.error('Error processing message aliases:', error);
    }
}

const event: Event<Events.MessageCreate> = {
    name: Events.MessageCreate,
    async execute(message: Message) {
        if (message.author.bot || !message.guild) return;

        // Process message aliases first
        await processMessageAliases(message);

        ensureActivityFlushTimer();
        queueMessageActivity(message.guild.id, new Date());

        try {
            const config = await getGuildConfigCached(message.guild.id);
            if (!config?.levelingEnabled) return;

            await db.insert(levelProfile)
                .values({
                    guildId: message.guild.id,
                    userId: message.author.id,
                    level: 0,
                    totalXp: 0,
                    textXp: 0,
                    voiceXp: 0,
                })
                .onConflictDoNothing({ target: [levelProfile.guildId, levelProfile.userId] });

            const profile = await db.query.levelProfile.findFirst({
                where: and(
                    eq(levelProfile.guildId, message.guild.id),
                    eq(levelProfile.userId, message.author.id)
                )
            });

            if (!profile) return;

            const now = new Date();
            if (profile.lastTextXpAt) {
                const diffMs = now.getTime() - profile.lastTextXpAt.getTime();
                const cooldownMs = config.textXpCooldown * 1000;
                if (diffMs < cooldownMs) return;
            }

            const min = config.textXpMin;
            const max = config.textXpMax;
            const xpEarned = Math.floor(Math.random() * (max - min + 1)) + min;

            const newTotalXp = profile.totalXp + xpEarned;
            const newTextXp = profile.textXp + xpEarned;
            const newLevel = calculateLevel(newTotalXp);

            await db.update(levelProfile)
                .set({
                    totalXp: newTotalXp,
                    textXp: newTextXp,
                    level: newLevel,
                    lastTextXpAt: now,
                    updatedAt: now
                })
                .where(eq(levelProfile.id, profile.id));

            if (newLevel > profile.level) {
                await checkAndAssignLevelRewards(message.member!, newLevel);
            }

            if (newLevel > profile.level && config.levelUpNotifEnabled) {
                const channelId = config.levelUpChannelId || message.channelId;
                const channel = message.guild.channels.cache.get(channelId) as TextChannel;

                if (channel && channel.isTextBased()) {
                    const variables = {
                        user: message.author.toString(),
                        level: newLevel.toString(),
                        xp: newTotalXp.toString()
                    };

                    let content = config.levelUpMessage;
                    const embedConfig = config.levelUpMessageEmbed as any;
                    const isEmbedEnabled = embedConfig?.enabled || (embedConfig && (embedConfig.title || embedConfig.description));

                    if (!content && !isEmbedEnabled) {
                        content = `🎉 **Level Up!** {user} has reached level **{level}**!`;
                    }

                    const messageData = buildMessage(
                        content,
                        config.levelUpMessageEmbed as any,
                        variables
                    );

                    if (messageData) {
                        await channel.send(messageData);
                    }
                }
            }

        } catch (error) {
            logger.error(`Error processing XP for message in ${message.guild.name}:`, error);
        }
    }
};

export default event;
