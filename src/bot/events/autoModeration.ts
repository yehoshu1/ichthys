import { Events, Message, PermissionFlagsBits } from 'discord.js';
import type { Event } from '../types/Event';
import logger from '../utils/logger';
import { db } from '../../shared/database/client';
import { moderationSettings, moderationCase } from '../../shared/database/schema';
import { eq, sql } from 'drizzle-orm';
import { emitGuildNotificationSafe } from '../services/notificationEmitter';

function getPositiveIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// In-memory spam tracking
const spamTracker = new Map<string, { count: number; timestamp: number }>();
const SPAM_WINDOW_MS = 5_000;
const MAX_SPAM_TRACKER_ENTRIES = getPositiveIntEnv('MAX_SPAM_TRACKER_ENTRIES', 10_000);

// 🎯 PERFORMANCE FIX: Pre-compiled static regex patterns
const INVITE_REGEX = /(discord\.gg\/[a-zA-Z0-9-]+|discord\.com\/invite\/[a-zA-Z0-9-]+|discordapp\.com\/invite\/[a-zA-Z0-9-]+)/i;

// 🎯 PERFORMANCE FIX: Cache for compiled word filter patterns
const compiledPatternCache = new Map<string, RegExp>();
const MAX_PATTERN_CACHE_SIZE = getPositiveIntEnv('MAX_PATTERN_CACHE_SIZE', 2_000);

/**
 * 🎯 PERFORMANCE FIX: Get or compile regex pattern
 * This prevents creating new RegExp objects on every message
 */
function getCompiledPattern(word: string): RegExp {
    const normalizedWord = word.toLowerCase().trim();

    // Check cache first
    const cached = compiledPatternCache.get(normalizedWord);
    if (cached) return cached;

    // Compile new pattern
    const pattern = new RegExp(`\\b${escapeRegex(normalizedWord)}\\b`, 'i');

    // 🎯 PERFORMANCE FIX: LRU-style cache management
    if (compiledPatternCache.size >= MAX_PATTERN_CACHE_SIZE) {
        // Remove oldest entries (first 10%)
        const entriesToRemove = Math.ceil(MAX_PATTERN_CACHE_SIZE * 0.1);
        const keys = Array.from(compiledPatternCache.keys()).slice(0, entriesToRemove);
        for (const key of keys) {
            compiledPatternCache.delete(key);
        }
    }

    compiledPatternCache.set(normalizedWord, pattern);
    return pattern;
}

/**
 * 🎯 PERFORMANCE FIX: Pre-compile common spam words on startup
 */
const COMMON_SPAM_WORDS = ['spam', 'scam', 'nitro', 'free', 'gift', 'steam', 'epic', 'giveaway'];
// Pre-compile common patterns
COMMON_SPAM_WORDS.forEach(word => getCompiledPattern(word));

interface CompiledModerationSettings {
    settings: typeof moderationSettings.$inferSelect;
    compiledPatterns: RegExp[];
    wordList: string[];
    lastCompiled: number;
}

// 🎯 PERFORMANCE FIX: Cache for compiled moderation settings per guild
const settingsCache = new Map<string, CompiledModerationSettings>();
const SETTINGS_CACHE_TTL_MS = 60_000; // 1 minute TTL

async function getNextCaseNumber(guildId: string): Promise<number> {
    const result = await db
        .select({ maxCase: sql<number>`max(${moderationCase.caseNumber})` })
        .from(moderationCase)
        .where(eq(moderationCase.guildId, guildId));
    return ((result[0] as any)?.maxCase || 0) + 1;
}

async function createAutoModCase(
    guildId: string,
    userId: string,
    action: 'WARN' | 'MUTE' | 'KICK',
    reason: string,
    duration?: number | null,
    expiresAt?: Date | null
) {
    const caseNumber = await getNextCaseNumber(guildId);

    await db.insert(moderationCase).values({
        guildId,
        caseNumber,
        userId,
        moderatorId: 'AUTO_MOD',
        action,
        reason,
        duration: duration ?? null,
        expiresAt: expiresAt ?? null,
        active: action !== 'KICK',
    });
}

/**
 * 🎯 PERFORMANCE FIX: Use pre-compiled patterns instead of creating new RegExp each time
 */
function containsBannedWords(content: string, compiledPatterns: RegExp[]): boolean {
    if (compiledPatterns.length === 0) return false;

    const lowerContent = content.toLowerCase();

    // Use pre-compiled patterns
    return compiledPatterns.some(pattern => pattern.test(lowerContent));
}

function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsInviteLink(content: string): boolean {
    // 🎯 PERFORMANCE FIX: Use pre-compiled static regex
    return INVITE_REGEX.test(content);
}

function checkSpam(userId: string, guildId: string, threshold: number): boolean {
    const key = `${userId}:${guildId}`;
    const now = Date.now();
    const windowMs = SPAM_WINDOW_MS; // 5 seconds

    // 🎯 PERFORMANCE FIX: Cleanup old entries if cache is too large
    if (spamTracker.size > MAX_SPAM_TRACKER_ENTRIES) {
        for (const [trackerKey, trackerEntry] of spamTracker.entries()) {
            if (now - trackerEntry.timestamp > windowMs) {
                spamTracker.delete(trackerKey);
            }
        }

        // If still too large, remove oldest entries
        if (spamTracker.size > MAX_SPAM_TRACKER_ENTRIES) {
            const oldest = Array.from(spamTracker.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
            const overflow = spamTracker.size - MAX_SPAM_TRACKER_ENTRIES;
            for (let i = 0; i < overflow; i += 1) {
                const [oldestKey] = oldest[i] ?? [];
                if (oldestKey) {
                    spamTracker.delete(oldestKey);
                }
            }
        }
    }

    const existing = spamTracker.get(key);

    if (!existing || now - existing.timestamp > windowMs) {
        spamTracker.set(key, { count: 1, timestamp: now });
        return false;
    }

    existing.count++;

    if (existing.count >= threshold) {
        spamTracker.delete(key);
        return true;
    }

    return false;
}

/**
 * 🎯 PERFORMANCE FIX: Fetch and compile moderation settings with caching
 */
async function getCompiledSettings(guildId: string): Promise<CompiledModerationSettings | null> {
    const cached = settingsCache.get(guildId);
    const now = Date.now();

    // Return cached settings if still valid
    if (cached && (now - cached.lastCompiled) < SETTINGS_CACHE_TTL_MS) {
        return cached;
    }

    // Fetch fresh settings
    const settings = await db.query.moderationSettings.findFirst({
        where: eq(moderationSettings.guildId, guildId)
    });

    if (!settings) return null;

    // 🎯 PERFORMANCE FIX: Pre-compile all word patterns
    let compiledPatterns: RegExp[] = [];
    let wordList: string[] = [];

    if (settings.wordFilterEnabled && settings.wordFilterList) {
        wordList = settings.wordFilterList.split(',').map(w => w.trim()).filter(Boolean);
        compiledPatterns = wordList.map(word => getCompiledPattern(word));
    }

    const compiled: CompiledModerationSettings = {
        settings,
        compiledPatterns,
        wordList,
        lastCompiled: now
    };

    settingsCache.set(guildId, compiled);
    return compiled;
}

/**
 * Clear moderation settings cache (call when settings are updated)
 */
export function invalidateModerationSettingsCache(guildId: string): void {
    settingsCache.delete(guildId);
}

const event: Event<Events.MessageCreate> = {
    name: Events.MessageCreate,
    async execute(message: Message) {
        // Ignore bots, DMs, and messages without guild
        if (message.author.bot || !message.guild) return;

        // Ignore users with Manage Messages permission
        const member = message.member;
        if (member?.permissions.has(PermissionFlagsBits.ManageMessages)) return;

        try {
            // 🎯 PERFORMANCE FIX: Use cached, pre-compiled settings
            const compiled = await getCompiledSettings(message.guild.id);
            if (!compiled) return;

            const { settings, compiledPatterns } = compiled;
            const content = message.content;

            // 🎯 PERFORMANCE FIX: Check banned words using pre-compiled patterns
            if (settings.wordFilterEnabled && compiledPatterns.length > 0) {
                const hasBannedWord = containsBannedWords(content, compiledPatterns);
                if (hasBannedWord) {
                    await handleBannedWord(message, settings);
                    return;
                }
            }

            // Check invite links
            if (settings.inviteFilterEnabled && containsInviteLink(content)) {
                await handleInviteLink(message, settings);
                return;
            }

            // Check spam
            if (settings.autoModEnabled && settings.spamThreshold) {
                if (checkSpam(message.author.id, message.guild.id, settings.spamThreshold)) {
                    await handleSpam(message, settings);
                    return;
                }
            }
        } catch (error) {
            logger.error('Error in auto-moderation:', error);
        }
    }
};

async function handleBannedWord(message: Message, settings: typeof moderationSettings.$inferSelect) {
    try {
        // Delete message
        await message.delete();

        const action = settings.wordFilterAction || 'WARN';

        switch (action) {
            case 'WARN':
                await message.author.send(`⚠️ Your message in **${message.guild!.name}** was deleted for containing banned words.`).catch((error) => { logger.warn(`Failed to send AutoMod DM to user ${message.author.tag}:`, error); return null; });
                await createAutoModCase(message.guild!.id, message.author.id, 'WARN', 'Used banned words');
                break;
            case 'MUTE':
                await applyMute(message, settings, 'Used banned words');
                break;
            case 'KICK':
                await message.author.send(`👢 You have been kicked from **${message.guild!.name}** for using banned words.`).catch((error) => { logger.warn(`Failed to send AutoMod DM to user ${message.author.tag}:`, error); return null; });
                await message.member!.kick('Used banned words');
                await createAutoModCase(message.guild!.id, message.author.id, 'KICK', 'Used banned words');
                break;
        }

        logger.info(`Auto-moderation: Deleted message with banned words from ${message.author.tag}`);
        await emitGuildNotificationSafe({
            guildId: message.guild!.id,
            eventType: 'AUTOMOD_BANNED_WORD_TRIGGERED',
            severity: 'WARNING',
            source: 'BOT_EVENT',
            title: `AutoMod banned-word triggered for ${message.author.tag}`,
            targetUserId: message.author.id,
            metadata: {
                action,
                channelId: message.channelId,
            },
            dedupeKey: `automod-banned-word:${message.author.id}`,
            dedupeWindowSeconds: 300,
        });
    } catch (error) {
        logger.error('Error handling banned word:', error);
        await emitGuildNotificationSafe({
            guildId: message.guild!.id,
            eventType: 'AUTOMOD_ACTION_FAILED',
            severity: 'ERROR',
            source: 'BOT_EVENT',
            title: `AutoMod banned-word handling failed`,
            body: error instanceof Error ? error.message : 'Unknown error',
            targetUserId: message.author.id,
            metadata: {
                channelId: message.channelId,
            },
            dedupeKey: `automod-action-failed:banned-word:${message.author.id}`,
            dedupeWindowSeconds: 900,
        });
    }
}

async function handleInviteLink(message: Message, settings: typeof moderationSettings.$inferSelect) {
    try {
        await message.delete();

        const action = settings.inviteFilterAction || 'DELETE';

        if (action === 'WARN') {
            await message.author.send(`⚠️ Your message in **${message.guild!.name}** was deleted for containing invite links.`).catch((error) => { logger.warn(`Failed to send AutoMod DM to user ${message.author.tag}:`, error); return null; });
            await createAutoModCase(message.guild!.id, message.author.id, 'WARN', 'Posted invite link');
        }

        logger.info(`Auto-moderation: Deleted invite link from ${message.author.tag}`);
        await emitGuildNotificationSafe({
            guildId: message.guild!.id,
            eventType: 'AUTOMOD_INVITE_TRIGGERED',
            severity: 'WARNING',
            source: 'BOT_EVENT',
            title: `AutoMod invite filter triggered for ${message.author.tag}`,
            targetUserId: message.author.id,
            metadata: {
                action,
                channelId: message.channelId,
            },
            dedupeKey: `automod-invite:${message.author.id}`,
            dedupeWindowSeconds: 300,
        });
    } catch (error) {
        logger.error('Error handling invite link:', error);
        await emitGuildNotificationSafe({
            guildId: message.guild!.id,
            eventType: 'AUTOMOD_ACTION_FAILED',
            severity: 'ERROR',
            source: 'BOT_EVENT',
            title: `AutoMod invite handling failed`,
            body: error instanceof Error ? error.message : 'Unknown error',
            targetUserId: message.author.id,
            metadata: {
                channelId: message.channelId,
            },
            dedupeKey: `automod-action-failed:invite:${message.author.id}`,
            dedupeWindowSeconds: 900,
        });
    }
}

async function handleSpam(message: Message, settings: typeof moderationSettings.$inferSelect) {
    try {
        const action = settings.spamAction || 'WARN';

        switch (action) {
            case 'WARN':
                await message.author.send(`⚠️ Please slow down in **${message.guild!.name}**. Spamming is not allowed.`).catch((error) => { logger.warn(`Failed to send AutoMod DM to user ${message.author.tag}:`, error); return null; });
                await createAutoModCase(message.guild!.id, message.author.id, 'WARN', 'Spamming');
                break;
            case 'MUTE':
                await applyMute(message, settings, 'Spamming');
                break;
            case 'KICK':
                await message.author.send(`👢 You have been kicked from **${message.guild!.name}** for spamming.`).catch((error) => { logger.warn(`Failed to send AutoMod DM to user ${message.author.tag}:`, error); return null; });
                await message.member!.kick('Spamming');
                await createAutoModCase(message.guild!.id, message.author.id, 'KICK', 'Spamming');
                break;
        }

        logger.info(`Auto-moderation: Handled spam from ${message.author.tag}`);
        await emitGuildNotificationSafe({
            guildId: message.guild!.id,
            eventType: 'AUTOMOD_SPAM_TRIGGERED',
            severity: 'WARNING',
            source: 'BOT_EVENT',
            title: `AutoMod spam triggered for ${message.author.tag}`,
            targetUserId: message.author.id,
            metadata: {
                action,
                channelId: message.channelId,
            },
            dedupeKey: `automod-spam:${message.author.id}`,
            dedupeWindowSeconds: 300,
        });
    } catch (error) {
        logger.error('Error handling spam:', error);
        await emitGuildNotificationSafe({
            guildId: message.guild!.id,
            eventType: 'AUTOMOD_ACTION_FAILED',
            severity: 'ERROR',
            source: 'BOT_EVENT',
            title: `AutoMod spam handling failed`,
            body: error instanceof Error ? error.message : 'Unknown error',
            targetUserId: message.author.id,
            metadata: {
                channelId: message.channelId,
            },
            dedupeKey: `automod-action-failed:spam:${message.author.id}`,
            dedupeWindowSeconds: 900,
        });
    }
}

async function applyMute(message: Message, settings: typeof moderationSettings.$inferSelect, reason: string) {
    if (!settings.muteRoleId) return;

    const muteRole = message.guild!.roles.cache.get(settings.muteRoleId);
    if (!muteRole) return;

    const duration = settings.spamMuteDuration || 10;
    const expiresAt = new Date(Date.now() + duration * 60 * 1000);

    await message.member!.roles.add(muteRole);
    await message.author.send(`🔇 You have been muted in **${message.guild!.name}** for ${duration} minutes${reason ? `: ${reason}` : ''}.`).catch((error) => { logger.warn(`Failed to send AutoMod DM to user ${message.author.tag}:`, error); return null; });

    await createAutoModCase(
        message.guild!.id,
        message.author.id,
        'MUTE',
        reason,
        duration,
        expiresAt
    );
}

export default event;
