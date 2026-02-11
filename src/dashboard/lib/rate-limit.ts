/**
 * Rate limiting utility for dashboard API routes
 * Uses LRU cache for in-memory storage (single instance)
 * For multi-instance deployments, Redis should be used
 */

import { LRUCache } from 'lru-cache';

export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfter?: number;
}

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

// In-memory store for rate limiting (per-instance)
// For production with multiple instances, use Redis
const rateLimitStore = new LRUCache<string, RateLimitEntry>({
    max: 10000,
    ttl: 60000, // 1 minute default TTL
});

/**
 * Check if a request is within rate limits
 */
export function checkRateLimit(
    identifier: string,
    config: RateLimitConfig
): RateLimitResult {
    const now = Date.now();
    const windowKey = Math.floor(now / config.windowMs);
    const key = `${identifier}:${windowKey}`;

    const entry = rateLimitStore.get(key);

    if (!entry) {
        // First request in this window
        const resetAt = (windowKey + 1) * config.windowMs;
        rateLimitStore.set(key, {
            count: 1,
            resetAt
        }, { ttl: config.windowMs });

        return {
            allowed: true,
            remaining: config.maxRequests - 1,
            resetAt
        };
    }

    if (entry.count >= config.maxRequests) {
        // Rate limit exceeded
        return {
            allowed: false,
            remaining: 0,
            resetAt: entry.resetAt,
            retryAfter: Math.ceil((entry.resetAt - now) / 1000)
        };
    }

    // Increment count
    entry.count++;

    return {
        allowed: true,
        remaining: config.maxRequests - entry.count,
        resetAt: entry.resetAt
    };
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult, maxRequests: number): Record<string, string> {
    return {
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, result.remaining).toString(),
        'X-RateLimit-Reset': Math.floor(result.resetAt / 1000).toString(),
    };
}

/**
 * Reset rate limit for an identifier (admin use)
 */
export function resetRateLimit(identifier: string, windowMs: number = 60000): void {
    const now = Date.now();
    const windowKey = Math.floor(now / windowMs);
    const key = `${identifier}:${windowKey}`;
    rateLimitStore.delete(key);
}

/**
 * Get current rate limit status for an identifier
 */
export function getRateLimitStatus(
    identifier: string,
    config: RateLimitConfig
): RateLimitResult {
    const now = Date.now();
    const windowKey = Math.floor(now / config.windowMs);
    const key = `${identifier}:${windowKey}`;

    const entry = rateLimitStore.get(key);

    if (!entry) {
        return {
            allowed: true,
            remaining: config.maxRequests,
            resetAt: (windowKey + 1) * config.windowMs
        };
    }

    return {
        allowed: entry.count < config.maxRequests,
        remaining: Math.max(0, config.maxRequests - entry.count),
        resetAt: entry.resetAt,
        retryAfter: entry.count >= config.maxRequests
            ? Math.ceil((entry.resetAt - now) / 1000)
            : undefined
    };
}
