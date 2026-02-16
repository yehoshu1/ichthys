/**
 * Rate limiting utility for dashboard API routes
 * Uses LRU cache for in-memory storage (single instance)
 * For multi-instance deployments, Redis should be used
 */

import { LRUCache } from 'lru-cache';
import { NextRequest } from 'next/server';
import logger from './logger';

export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
    windowMs: 60_000,
    maxRequests: 120,
};

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

interface RedisRateLimitClient {
    on(event: 'error', listener: (error: unknown) => void): this;
    connect(): Promise<void>;
    incr(key: string): Promise<number>;
    pexpire(key: string, ttlMs: number): Promise<number>;
}

interface RedisRateLimitOptions {
    maxRetriesPerRequest: number;
    lazyConnect: boolean;
}

type RedisRateLimitConstructor = new (url: string, options: RedisRateLimitOptions) => RedisRateLimitClient;

// In-memory store for rate limiting (per-instance)
// For production with multiple instances, use Redis
const rateLimitStore = new LRUCache<string, RateLimitEntry>({
    max: 10000,
    ttl: 60000, // 1 minute default TTL
});

let redisClient: RedisRateLimitClient | null = null;
let redisInitAttempted = false;

function loadRedisConstructor(): RedisRateLimitConstructor | null {
    try {
        const req = (0, eval)('require') as (id: string) => unknown;
        const redisModule = req('ioredis') as { default?: RedisRateLimitConstructor } | RedisRateLimitConstructor;
        return typeof redisModule === 'function'
            ? redisModule
            : (redisModule.default ?? null);
    } catch {
        return null;
    }
}

function getRedisClient(): RedisRateLimitClient | null {
    if (redisInitAttempted) {
        return redisClient;
    }

    redisInitAttempted = true;
    const redisUrl = process.env.REDIS_URL?.trim();
    if (!redisUrl) {
        return null;
    }

    try {
        const Redis = loadRedisConstructor();
        if (!Redis) {
            logger.warn('REDIS_URL is set but ioredis is not installed; using in-memory fallback');
            return null;
        }

        redisClient = new Redis(redisUrl, {
            maxRetriesPerRequest: 1,
            lazyConnect: true,
        });

            redisClient.on('error', (error: unknown) => {
            logger.warn('Redis rate-limit backend error, falling back to memory', { error: String(error) });
        });
    } catch (error) {
        logger.warn('Failed to initialize Redis rate-limit backend, using memory fallback', { error: String(error) });
        redisClient = null;
    }

    return redisClient;
}

export interface RateLimitStoreMetrics {
    entries: number;
    maxEntries: number;
}

/**
 * Check if a request is within rate limits
 */
export function checkRateLimit(
    identifier: string,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    const redis = getRedisClient();
    if (redis) {
        return checkRateLimitRedis(redis, identifier, config);
    }

    return Promise.resolve(checkRateLimitMemory(identifier, config));
}

function checkRateLimitMemory(
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

async function checkRateLimitRedis(
    redis: RedisRateLimitClient,
    identifier: string,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    const now = Date.now();
    const windowKey = Math.floor(now / config.windowMs);
    const key = `rl:${identifier}:${windowKey}`;
    const resetAt = (windowKey + 1) * config.windowMs;
    const ttlMs = Math.max(1, resetAt - now);

    try {
        await redis.connect().catch(() => undefined);
        const count = await redis.incr(key);
        if (count === 1) {
            await redis.pexpire(key, ttlMs);
        }

        if (count > config.maxRequests) {
            return {
                allowed: false,
                remaining: 0,
                resetAt,
                retryAfter: Math.ceil((resetAt - now) / 1000),
            };
        }

        return {
            allowed: true,
            remaining: Math.max(0, config.maxRequests - count),
            resetAt,
        };
    } catch (error) {
        logger.warn('Redis rate-limit check failed, using memory fallback', { error: String(error) });
        return checkRateLimitMemory(identifier, config);
    }
}

export function getClientIp(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0]?.trim() || 'unknown';
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
        return realIp.trim();
    }

    return 'unknown';
}

export function buildRateLimitKey(request: NextRequest, suffix: string): string {
    const ip = getClientIp(request);
    return `${ip}:${suffix}`;
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

export function getRateLimitStoreMetrics(): RateLimitStoreMetrics {
    return {
        entries: rateLimitStore.size,
        maxEntries: rateLimitStore.max,
    };
}

export function isRedisRateLimitEnabled(): boolean {
    return !!process.env.REDIS_URL;
}
