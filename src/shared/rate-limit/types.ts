/**
 * Rate limiting types and interfaces
 */

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfter?: number;
}

export interface RateLimiter {
    check(userId: string, guildId: string | null, commandName: string): Promise<RateLimitResult>;
    reset(userId: string, guildId: string | null): Promise<void>;
}

export interface RateLimitConfig {
    maxCommands: number;
    windowMs: number;
    cooldownMs?: number;
}
