/**
 * Rate limiter for Discord bot commands
 * Prevents command spam and abuse
 */

import logger from './logger';

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

interface RateLimitConfig {
    // Max commands per window
    maxCommands: number;
    // Window duration in milliseconds
    windowMs: number;
    // Cooldown duration in milliseconds (after hitting limit)
    cooldownMs: number;
}

// Default rate limits by command type
const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
    // Public commands - more lenient
    default: {
        maxCommands: 10,
        windowMs: 60_000, // 1 minute
        cooldownMs: 30_000, // 30 seconds
    },
    // XP/level related commands
    xp: {
        maxCommands: 5,
        windowMs: 60_000,
        cooldownMs: 60_000,
    },
    // Admin commands - stricter
    admin: {
        maxCommands: 20,
        windowMs: 60_000,
        cooldownMs: 30_000,
    },
};

// In-memory rate limit storage
// Key: "userId:guildId" or "userId:dm"
const rateLimitMap = new Map<string, RateLimitEntry>();

// Maximum number of entries to prevent unbounded growth
const MAX_ENTRIES = 10000;

// Cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Store interval ID for cleanup
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Clean up expired rate limit entries
 */
function cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of rateLimitMap.entries()) {
        if (entry.resetAt < now) {
            rateLimitMap.delete(key);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
    }
}

// Start cleanup interval
function startCleanupInterval(): void {
    if (cleanupIntervalId) return; // Already started
    cleanupIntervalId = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
}

/**
 * Stop the cleanup interval (for graceful shutdown)
 */
export function stopCleanupInterval(): void {
    if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
        cleanupIntervalId = null;
        logger.info('Rate limiter cleanup interval stopped');
    }
}

/**
 * Get current map size for monitoring
 */
export function getRateLimitMapSize(): number {
    return rateLimitMap.size;
}

// Start the interval
startCleanupInterval();

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfter?: number;
}

/**
 * Check if a user is rate limited
 * @param userId - Discord user ID
 * @param guildId - Discord guild ID (or 'dm' for direct messages)
 * @param commandName - Command being executed
 * @param customConfig - Optional custom rate limit config
 * @returns RateLimitResult with allowed status and remaining commands
 */
export function checkRateLimit(
    userId: string,
    guildId: string | null,
    commandName: string,
    customConfig?: RateLimitConfig
): RateLimitResult {
    const key = `${userId}:${guildId || 'dm'}`;
    const now = Date.now();

    // Determine rate limit config
    let config = customConfig || DEFAULT_LIMITS.default;

    // Apply command-specific limits
    if (['rank', 'leaderboard'].includes(commandName)) {
        config = DEFAULT_LIMITS.xp;
    } else if (['setup', 'config', 'welcome', 'boost', 'verify'].includes(commandName)) {
        config = DEFAULT_LIMITS.admin;
    }

    const entry = rateLimitMap.get(key);

    // Check if map is at capacity and cleanup if needed
    if (rateLimitMap.size >= MAX_ENTRIES) {
        cleanupExpiredEntries();
        // If still at capacity, remove oldest entries
        if (rateLimitMap.size >= MAX_ENTRIES) {
            const sortedEntries = Array.from(rateLimitMap.entries())
                .sort((a, b) => a[1].resetAt - b[1].resetAt);
            const entriesToRemove = Math.ceil(MAX_ENTRIES * 0.1); // Remove 10%
            for (let i = 0; i < entriesToRemove && i < sortedEntries.length; i++) {
                rateLimitMap.delete(sortedEntries[i][0]);
            }
            logger.warn(`Rate limit map reached capacity, removed ${entriesToRemove} oldest entries`);
        }
    }

    // No entry exists - create new one
    if (!entry) {
        rateLimitMap.set(key, {
            count: 1,
            resetAt: now + config.windowMs,
        });
        return {
            allowed: true,
            remaining: config.maxCommands - 1,
            resetAt: now + config.windowMs,
        };
    }

    // Entry expired - reset
    if (entry.resetAt < now) {
        rateLimitMap.set(key, {
            count: 1,
            resetAt: now + config.windowMs,
        });
        return {
            allowed: true,
            remaining: config.maxCommands - 1,
            resetAt: now + config.windowMs,
        };
    }

    // Check if over limit
    if (entry.count >= config.maxCommands) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        logger.warn(`Rate limit hit for user ${userId} in guild ${guildId} (command: ${commandName})`);
        return {
            allowed: false,
            remaining: 0,
            resetAt: entry.resetAt,
            retryAfter,
        };
    }

    // Increment count
    entry.count++;

    return {
        allowed: true,
        remaining: config.maxCommands - entry.count,
        resetAt: entry.resetAt,
    };
}

/**
 * Format a rate limit message for users
 * @param result - RateLimitResult from checkRateLimit
 * @returns Formatted message string
 */
export function formatRateLimitMessage(result: RateLimitResult): string {
    if (!result.retryAfter) {
        return 'You are being rate limited. Please try again later.';
    }

    const seconds = result.retryAfter;
    if (seconds < 60) {
        return `⏱️ Please wait ${seconds} second${seconds === 1 ? '' : 's'} before using this command again.`;
    }

    const minutes = Math.ceil(seconds / 60);
    return `⏱️ Please wait ${minutes} minute${minutes === 1 ? '' : 's'} before using this command again.`;
}

/**
 * Get rate limit info for a user (for debugging/admin purposes)
 * @param userId - Discord user ID
 * @param guildId - Discord guild ID
 * @returns Current rate limit entry or null
 */
export function getRateLimitInfo(userId: string, guildId: string | null): RateLimitEntry | null {
    const key = `${userId}:${guildId || 'dm'}`;
    return rateLimitMap.get(key) || null;
}

/**
 * Reset rate limit for a user (for admin use)
 * @param userId - Discord user ID
 * @param guildId - Discord guild ID
 */
export function resetRateLimit(userId: string, guildId: string | null): void {
    const key = `${userId}:${guildId || 'dm'}`;
    rateLimitMap.delete(key);
    logger.info(`Rate limit reset for user ${userId} in guild ${guildId}`);
}
