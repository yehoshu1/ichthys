/**
 * Discord API response caching to prevent rate limits
 */

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

class DiscordCache {
    private cache = new Map<string, CacheEntry<unknown>>();
    private readonly DEFAULT_TTL_MS = 30_000; // 30 seconds
    private readonly MAX_CACHE_ENTRIES = 2_000;

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return entry.data as T;
    }

    set<T>(key: string, data: T, ttlMs: number = this.DEFAULT_TTL_MS): void {
        if (this.cache.size >= this.MAX_CACHE_ENTRIES) {
            this.cleanup();
        }

        if (this.cache.size >= this.MAX_CACHE_ENTRIES) {
            const entries = Array.from(this.cache.entries()).sort((a, b) => a[1].expiresAt - b[1].expiresAt);
            const [oldestKey] = entries[0] ?? [];
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }

        this.cache.set(key, {
            data,
            expiresAt: Date.now() + ttlMs,
        });
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    // Clean up expired entries periodically
    cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    size(): number {
        return this.cache.size;
    }

    maxEntries(): number {
        return this.MAX_CACHE_ENTRIES;
    }
}

export const discordCache = new DiscordCache();

// Auto-cleanup every 5 minutes
const cacheCleanupInterval = setInterval(() => discordCache.cleanup(), 5 * 60 * 1000);
cacheCleanupInterval.unref?.();

// Request deduplication for in-flight requests
const inFlightRequests = new Map<string, Promise<unknown>>();
const MAX_IN_FLIGHT_REQUESTS = 1_000;

export async function dedupeRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = inFlightRequests.get(key);
    if (existing) {
        return existing as Promise<T>;
    }

    if (inFlightRequests.size >= MAX_IN_FLIGHT_REQUESTS) {
        return fn();
    }

    const promise = fn().finally(() => {
        inFlightRequests.delete(key);
    });

    inFlightRequests.set(key, promise);
    return promise;
}

export function getDiscordCacheMetrics(): {
    entries: number;
    maxEntries: number;
    inFlightRequests: number;
    maxInFlightRequests: number;
} {
    return {
        entries: discordCache.size(),
        maxEntries: discordCache.maxEntries(),
        inFlightRequests: inFlightRequests.size,
        maxInFlightRequests: MAX_IN_FLIGHT_REQUESTS,
    };
}
