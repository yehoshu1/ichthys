# ΙΧΘΥΣ Performance Fix Implementation Plan

**Version:** 1.0  
**Date:** 2026-02-11  
**Estimated Duration:** 2-3 weeks  
**Priority:** Critical for production scalability

---

## Overview

This plan provides a structured, phased approach to addressing all performance issues identified in the performance review. Each phase builds upon the previous one, with clear acceptance criteria and testing strategies.

## Phase Structure

```
Phase 1: Critical Hotfixes (Week 1)
├── Task 1.1: Fix N+1 Queries in Voice XP Job
├── Task 1.2: Pre-compile Auto-Moderation Regex
├── Task 1.3: Add Limits to Alias Queries
└── Task 1.4: Optimize Reaction Role Queries

Phase 2: API Hardening (Week 1-2)
├── Task 2.1: Implement API Rate Limiting
├── Task 2.2: Add Database Query Timeouts
├── Task 2.3: Add Connection Pool Monitoring
└── Task 2.4: Implement Request Validation

Phase 3: Caching & Memory (Week 2)
├── Task 3.1: Implement Distributed Rate Limiting
├── Task 3.2: Add Cache Cleanup Jobs
├── Task 3.3: Optimize Frontend Re-renders
└── Task 3.4: Cache Message Templates

Phase 4: Database Optimization (Week 2-3)
├── Task 4.1: Add Missing Indexes
├── Task 4.2: Implement Pagination for Large Queries
├── Task 4.3: Add Batch Processing
└── Task 4.4: Optimize Analytics Queries

Phase 5: Monitoring & Infrastructure (Week 3)
├── Task 5.1: Add Performance Metrics
├── Task 5.2: Implement Alerting
├── Task 5.3: Add Load Testing
└── Task 5.4: Documentation & Runbooks
```

---

## Phase 1: Critical Hotfixes (Days 1-5)

### Task 1.1: Fix N+1 Queries in Voice XP Job

**Priority:** P0  
**Effort:** 4 hours  
**Risk:** Low  
**File:** `src/bot/jobs/processVoiceXp.ts`

#### Implementation Steps

1. **Add batch guild config fetching function:**

```typescript
// Add at the top of processVoiceXp.ts
async function getGuildConfigsBatch(
    guildIds: string[]
): Promise<Map<string, GuildConfig>> {
    if (guildIds.length === 0) return new Map();
    
    const configs = await db
        .select()
        .from(guildConfig)
        .where(inArray(guildConfig.guildId, guildIds));
    
    return new Map(configs.map(c => [c.guildId, c]));
}
```

2. **Modify `processVoiceXpOnce` to batch fetch:**

```typescript
export async function processVoiceXpOnce(): Promise<void> {
    const stats: VoiceXpRunStats = {
        // ... existing stats
    };

    let cursorId: string | null = null;
    let hasMore = true;

    while (hasMore) {
        // Fetch chunk of active profiles
        const activeProfiles: ActiveVoiceProfile[] = cursorId
            ? await db.select({...})
                .from(levelProfile)
                .where(and(
                    isNotNull(levelProfile.voiceJoinedAt),
                    gt(levelProfile.id, cursorId)
                ))
                .orderBy(asc(levelProfile.id))
                .limit(CHUNK_SIZE)
            : await db.select({...})
                .from(levelProfile)
                .where(isNotNull(levelProfile.voiceJoinedAt))
                .orderBy(asc(levelProfile.id))
                .limit(CHUNK_SIZE);

        if (activeProfiles.length === 0) {
            hasMore = false;
            break;
        }

        cursorId = activeProfiles[activeProfiles.length - 1].id;

        // 🎯 BATCH FETCH ALL GUILD CONFIGS AT ONCE
        const uniqueGuildIds = [...new Set(activeProfiles.map(p => p.guildId))];
        const guildConfigMap = await getGuildConfigsBatch(uniqueGuildIds);

        const now = new Date();

        // Process profiles with cached configs
        for (const activeProfile of activeProfiles) {
            stats.processedProfiles += 1;

            try {
                // Use cached config instead of fetching
                const config = guildConfigMap.get(activeProfile.guildId) ?? null;
                
                if (!config?.levelingEnabled) {
                    stats.skippedDisabled += 1;
                    // ... rest of disabled logic
                    continue;
                }

                // ... rest of processing logic unchanged
            } catch (error) {
                // ... error handling
            }
        }

        // Add small delay between chunks to prevent event loop blocking
        if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }

    logger.info(/* ... stats ... */);
}
```

3. **Remove the old `getGuildConfigCached` function** (or deprecate it)

#### Testing Strategy

```typescript
// Create test file: src/bot/jobs/__tests__/processVoiceXp.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processVoiceXpOnce } from '../processVoiceXp';

describe('processVoiceXp', () => {
    it('should batch fetch guild configs', async () => {
        // Mock 100 active profiles across 10 guilds
        // Verify only 1 query for guild configs vs 100 before
    });

    it('should process profiles in chunks', async () => {
        // Verify processing doesn't block event loop
    });
});
```

#### Rollback Plan
- Keep old function commented out for 1 week
- Monitor job execution time in logs
- Alert if job duration increases by >20%

---

### Task 1.2: Pre-compile Auto-Moderation Regex

**Priority:** P0  
**Effort:** 3 hours  
**Risk:** Low  
**File:** `src/bot/events/autoModeration.ts`

#### Implementation Steps

1. **Create compiled pattern cache:**

```typescript
// At the top of autoModeration.ts, after imports

// Cache for compiled regex patterns
const compiledPatternCache = new Map<string, RegExp>();
const MAX_PATTERN_CACHE_SIZE = 5000;

function getCompiledPattern(word: string): RegExp {
    const normalizedWord = word.toLowerCase().trim();
    
    // Check cache
    const cached = compiledPatternCache.get(normalizedWord);
    if (cached) return cached;
    
    // Compile new pattern
    const pattern = new RegExp(`\\b${escapeRegex(normalizedWord)}\\b`, 'i');
    
    // Cache management - LRU eviction
    if (compiledPatternCache.size >= MAX_PATTERN_CACHE_SIZE) {
        const oldestKey = compiledPatternCache.keys().next().value;
        if (oldestKey) compiledPatternCache.delete(oldestKey);
    }
    
    compiledPatternCache.set(normalizedWord, pattern);
    return pattern;
}

// Pre-compile common patterns on startup
const COMMON_PATTERNS = ['spam', 'scam', 'nitro', 'free', 'gift'];
COMMON_PATTERNS.forEach(word => getCompiledPattern(word));
```

2. **Update `containsBannedWords` function:**

```typescript
function containsBannedWords(content: string, wordList: string[]): boolean {
    const lowerContent = content.toLowerCase();
    
    // Use pre-compiled patterns
    return wordList.some(word => {
        const pattern = getCompiledPattern(word);
        return pattern.test(lowerContent);
    });
}
```

3. **Add invite regex caching:**

```typescript
// Cache compiled invite regex (it's static)
const INVITE_REGEX = /(discord\.gg\/[a-zA-Z0-9-]+|discord\.com\/invite\/[a-zA-Z0-9-]+|discordapp\.com\/invite\/[a-zA-Z0-9-]+)/i;

function containsInviteLink(content: string): boolean {
    return INVITE_REGEX.test(content);
}
```

4. **Add settings-level pattern pre-compilation:**

```typescript
// Add to moderationSettings service or cache
interface CompiledModerationSettings {
    settings: typeof moderationSettings.$inferSelect;
    compiledPatterns: RegExp[];
    lastCompiled: number;
}

const settingsCache = new Map<string, CompiledModerationSettings>();
const SETTINGS_CACHE_TTL_MS = 60_000;

async function getCompiledSettings(guildId: string): Promise<CompiledModerationSettings | null> {
    const cached = settingsCache.get(guildId);
    const now = Date.now();
    
    if (cached && (now - cached.lastCompiled) < SETTINGS_CACHE_TTL_MS) {
        return cached;
    }
    
    const settings = await db.query.moderationSettings.findFirst({
        where: eq(moderationSettings.guildId, guildId)
    });
    
    if (!settings) return null;
    
    // Pre-compile all patterns
    let compiledPatterns: RegExp[] = [];
    if (settings.wordFilterList) {
        const words = settings.wordFilterList.split(',').map(w => w.trim()).filter(Boolean);
        compiledPatterns = words.map(word => getCompiledPattern(word));
    }
    
    const compiled: CompiledModerationSettings = {
        settings,
        compiledPatterns,
        lastCompiled: now
    };
    
    settingsCache.set(guildId, compiled);
    return compiled;
}
```

5. **Update main event handler:**

```typescript
const event: Event<Events.MessageCreate> = {
    name: Events.MessageCreate,
    async execute(message: Message) {
        if (message.author.bot || !message.guild) return;
        
        const member = message.member;
        if (member?.permissions.has(PermissionFlagsBits.ManageMessages)) return;

        try {
            // Use compiled settings
            const compiled = await getCompiledSettings(message.guild.id);
            if (!compiled) return;
            
            const { settings, compiledPatterns } = compiled;
            const content = message.content;

            // Check banned words using pre-compiled patterns
            if (settings.wordFilterEnabled && compiledPatterns.length > 0) {
                const hasBannedWord = compiledPatterns.some(pattern => 
                    pattern.test(content.toLowerCase())
                );
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
```

#### Testing Strategy

```typescript
// Test regex compilation performance
const iterations = 10000;

// Before: ~500ms for 1000 iterations
console.time('without-cache');
for (let i = 0; i < iterations; i++) {
    const regex = new RegExp(`\\btest\\b`, 'i');
    regex.test('this is a test message');
}
console.timeEnd('without-cache');

// After: ~5ms for 1000 iterations
console.time('with-cache');
for (let i = 0; i < iterations; i++) {
    const regex = getCompiledPattern('test');
    regex.test('this is a test message');
}
console.timeEnd('with-cache');
```

#### Rollback Plan
- Keep original function commented out
- Feature flag to disable pre-compilation if issues arise

---

### Task 1.3: Add Limits to Alias Queries

**Priority:** P0  
**Effort:** 2 hours  
**Risk:** Very Low  
**Files:** 
- `src/bot/services/messageAliasService.ts`
- `src/bot/events/messageCreate.ts`

#### Implementation Steps

1. **Update service method:**

```typescript
// In messageAliasService.ts
const MAX_ALIASES_PER_GUILD = 100;

async getEnabledAliases(guildId: string): Promise<MessageAlias[]> {
    return await db
        .select()
        .from(messageAlias)
        .where(and(
            eq(messageAlias.guildId, guildId),
            eq(messageAlias.enabled, true)
        ))
        .limit(MAX_ALIASES_PER_GUILD); // Add limit
}
```

2. **Add warning log for limit exceeded:**

```typescript
async getEnabledAliases(guildId: string): Promise<MessageAlias[]> {
    const aliases = await db
        .select()
        .from(messageAlias)
        .where(and(
            eq(messageAlias.guildId, guildId),
            eq(messageAlias.enabled, true)
        ))
        .limit(MAX_ALIASES_PER_GUILD + 1); // Fetch one extra to check if limit exceeded
    
    if (aliases.length > MAX_ALIASES_PER_GUILD) {
        logger.warn(`Guild ${guildId} has more than ${MAX_ALIASES_PER_GUILD} aliases. Some may not be processed.`);
        return aliases.slice(0, MAX_ALIASES_PER_GUILD);
    }
    
    return aliases;
}
```

3. **Add database-level enforcement (optional):**

```typescript
// In schema.ts, add a check constraint or trigger
// This is more aggressive - prevents insertion beyond limit
```

#### Testing Strategy
- Create 105 aliases in test guild
- Verify only 100 are processed
- Check warning log is emitted

---

### Task 1.4: Optimize Reaction Role Queries

**Priority:** P0  
**Effort:** 4 hours  
**Risk:** Low  
**File:** `src/bot/events/messageReactionAdd.ts`

#### Implementation Steps

1. **Add reaction role cache:**

```typescript
// At top of file, after imports
interface ReactionRoleCacheEntry {
    roles: typeof reactionRole.$inferSelect[];
    expiresAt: number;
}

const reactionRoleCache = new Map<string, ReactionRoleCacheEntry>();
const REACTION_ROLE_CACHE_TTL_MS = 60_000; // 1 minute
const MAX_REACTION_ROLE_CACHE_ENTRIES = 1000;

function getCacheKey(messageId: string): string {
    return messageId;
}

async function getReactionRolesForMessage(messageId: string) {
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
        limit: 50 // Reasonable limit per message
    });
    
    // Cache management
    if (reactionRoleCache.size >= MAX_REACTION_ROLE_CACHE_ENTRIES) {
        // Remove oldest entries
        const entries = Array.from(reactionRoleCache.entries())
            .sort((a, b) => a[1].expiresAt - b[1].expiresAt);
        const toRemove = Math.ceil(MAX_REACTION_ROLE_CACHE_ENTRIES * 0.1); // Remove 10%
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
```

2. **Update `handleUnique` function:**

```typescript
async function handleUnique(
    member: GuildMember,
    role: Role,
    reaction: MessageReaction | PartialMessageReaction,
    exclusiveRoleIds?: string[] | null
) {
    // Use cached reaction roles
    const otherReactionRoles = await getReactionRolesForMessage(reaction.message.id);
    
    const allExclusiveIds = new Set([
        ...(exclusiveRoleIds ?? []),
        ...otherReactionRoles.map(r => r.roleId).filter(id => id !== role.id)
    ]);
    
    // ... rest of function
}
```

3. **Add cache invalidation on role update:**

```typescript
// Export for use in reaction role management commands
export function invalidateReactionRoleCache(messageId: string): void {
    reactionRoleCache.delete(getCacheKey(messageId));
}

// Call this when reaction roles are modified via dashboard/commands
```

---

## Phase 2: API Hardening (Days 4-10)

### Task 2.1: Implement API Rate Limiting

**Priority:** P1  
**Effort:** 8 hours  
**Risk:** Medium (could block legitimate users if misconfigured)  
**Files:**
- `src/dashboard/middleware.ts` (new or updated)
- `src/dashboard/lib/rate-limit.ts` (new)

#### Implementation Steps

1. **Create rate limiting utility:**

```typescript
// src/dashboard/lib/rate-limit.ts
import { LRUCache } from 'lru-cache';

interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
}

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

// In-memory store (for single instance)
// For multi-instance, use Redis
const rateLimitStore = new LRUCache<string, RateLimitEntry>({
    max: 10000,
    ttl: 60000, // 1 minute
});

export function checkRateLimit(
    identifier: string,
    config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const key = `${identifier}:${Math.floor(now / config.windowMs)}`;
    
    const entry = rateLimitStore.get(key);
    
    if (!entry) {
        rateLimitStore.set(key, {
            count: 1,
            resetAt: now + config.windowMs
        });
        return {
            allowed: true,
            remaining: config.maxRequests - 1,
            resetAt: now + config.windowMs
        };
    }
    
    if (entry.count >= config.maxRequests) {
        return {
            allowed: false,
            remaining: 0,
            resetAt: entry.resetAt
        };
    }
    
    entry.count++;
    return {
        allowed: true,
        remaining: config.maxRequests - entry.count,
        resetAt: entry.resetAt
    };
}

export function getRateLimitHeaders(result: { allowed: boolean; remaining: number; resetAt: number }) {
    return {
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': Math.floor(result.resetAt / 1000).toString(),
    };
}
```

2. **Create rate limiting middleware:**

```typescript
// src/dashboard/lib/rate-limit-middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitHeaders } from './rate-limit';
import logger from './logger';

// Different limits for different endpoints
const RATE_LIMITS: Record<string, { windowMs: number; maxRequests: number }> = {
    default: { windowMs: 60000, maxRequests: 100 },
    'discord-data': { windowMs: 60000, maxRequests: 30 }, // Expensive endpoint
    'analytics': { windowMs: 60000, maxRequests: 20 },    // Data-heavy
    'members': { windowMs: 60000, maxRequests: 50 },
    'settings': { windowMs: 60000, maxRequests: 30 },     // Write operations
};

export function createRateLimiter(endpointType: string = 'default') {
    return async function rateLimitMiddleware(
        req: NextRequest
    ): Promise<NextResponse | null> {
        // Get identifier (user ID from session, or IP as fallback)
        const identifier = await getUserIdentifier(req);
        const config = RATE_LIMITS[endpointType] || RATE_LIMITS.default;
        
        const result = checkRateLimit(identifier, config);
        
        if (!result.allowed) {
            logger.warn('Rate limit exceeded', {
                identifier,
                endpoint: endpointType,
                path: req.url
            });
            
            return new NextResponse(
                JSON.stringify({ error: 'Rate limit exceeded' }),
                {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'Retry-After': Math.ceil((result.resetAt - Date.now()) / 1000).toString(),
                        ...getRateLimitHeaders(result)
                    }
                }
            );
        }
        
        // Return headers to be added to successful response
        return NextResponse.next({
            headers: getRateLimitHeaders(result)
        });
    };
}

async function getUserIdentifier(req: NextRequest): Promise<string> {
    // Try to get user ID from session
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (token?.sub) {
        return `user:${token.sub}`;
    }
    
    // Fall back to IP
    const ip = req.ip ?? req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
    return `ip:${ip}`;
}
```

3. **Apply to API routes:**

```typescript
// Example: src/dashboard/app/api/guilds/[guildId]/discord-data/route.ts
import { createRateLimiter } from '@/lib/rate-limit-middleware';

const rateLimiter = createRateLimiter('discord-data');

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    // Check rate limit
    const rateLimitResult = await rateLimiter(req);
    if (rateLimitResult instanceof NextResponse) {
        return rateLimitResult; // Rate limited
    }
    
    // ... rest of handler
    
    // Add rate limit headers to response
    const response = NextResponse.json(data);
    rateLimitResult.headers.forEach((value, key) => {
        response.headers.set(key, value);
    });
    return response;
}
```

4. **Install LRU cache:**

```bash
npm install lru-cache
npm install --save-dev @types/lru-cache
```

#### Testing Strategy
- Use `autocannon` or `k6` to test rate limiting
- Verify 429 responses after limit exceeded
- Check headers are present

---

### Task 2.2: Add Database Query Timeouts

**Priority:** P1  
**Effort:** 2 hours  
**Risk:** Low  
**File:** `src/shared/database/client.ts`

#### Implementation Steps

1. **Update pool configuration:**

```typescript
// src/shared/database/client.ts

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://ixoye:ixoye@localhost:5432/ixoye';

export const pool = new Pool({
    connectionString: databaseUrl,
    max: Number(process.env.PG_POOL_MAX ?? 20),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30_000),
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS ?? 10_000),
    // Add query timeout
    query_timeout: Number(process.env.PG_QUERY_TIMEOUT_MS ?? 30_000),
    statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS ?? 30_000),
    ssl: process.env.NODE_ENV === 'production' 
        ? { rejectUnauthorized: true }
        : process.env.PG_SSL === 'true' 
            ? { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false' }
            : false,
});

// Add connection validation
pool.on('connect', (client) => {
    client.on('error', (err) => {
        logger.error('PostgreSQL client error:', err);
    });
});

// Add pool monitoring
pool.on('acquire', () => {
    metrics?.poolConnectionsAcquired?.inc();
});

pool.on('remove', () => {
    metrics?.poolConnectionsRemoved?.inc();
});
```

2. **Add environment variables:**

```bash
# .env.example
PG_POOL_MAX=20
PG_IDLE_TIMEOUT_MS=30000
PG_CONNECT_TIMEOUT_MS=10000
PG_QUERY_TIMEOUT_MS=30000
PG_STATEMENT_TIMEOUT_MS=30000
```

3. **Add query timeout wrapper for long queries:**

```typescript
// src/shared/database/query-utils.ts
import { db } from './client';
import { SQL } from 'drizzle-orm';

export async function executeWithTimeout<T>(
    query: Promise<T>,
    timeoutMs: number = 30000,
    operationName: string = 'query'
): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
            reject(new Error(`Query timeout: ${operationName} exceeded ${timeoutMs}ms`));
        }, timeoutMs);
    });
    
    return Promise.race([query, timeoutPromise]);
}

// Usage in critical paths
const result = await executeWithTimeout(
    db.select().from(largeTable).where(...),
    5000,
    'fetchAnalytics'
);
```

---

### Task 2.3: Add Connection Pool Monitoring

**Priority:** P1  
**Effort:** 3 hours  
**Risk:** Low  
**File:** `src/shared/database/client.ts`

#### Implementation Steps

1. **Add pool metrics:**

```typescript
// src/shared/database/pool-metrics.ts
import { Pool } from 'pg';
import logger from '../bot/utils/logger';

interface PoolMetrics {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
}

export function startPoolMonitoring(pool: Pool, intervalMs: number = 60000): void {
    setInterval(() => {
        const metrics: PoolMetrics = {
            totalCount: pool.totalCount,
            idleCount: pool.idleCount,
            waitingCount: pool.waitingCount,
        };
        
        // Log metrics
        logger.debug('PostgreSQL pool metrics', metrics);
        
        // Alert on high connection usage
        if (metrics.waitingCount > 5) {
            logger.warn('High pool contention detected', metrics);
        }
        
        if (metrics.totalCount > pool.options.max * 0.9) {
            logger.warn('Pool near capacity', metrics);
        }
    }, intervalMs);
}

export async function checkPoolHealth(pool: Pool): Promise<boolean> {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        return true;
    } catch (error) {
        logger.error('Pool health check failed:', error);
        return false;
    }
}
```

2. **Integrate into client:**

```typescript
// Add to client.ts after pool creation
import { startPoolMonitoring, checkPoolHealth } from './pool-metrics';

startPoolMonitoring(pool);

// Health check endpoint can use this
export { checkPoolHealth };
```

---

## Phase 3: Caching & Memory Optimization (Days 8-12)

### Task 3.1: Implement Distributed Rate Limiting

**Priority:** P2  
**Effort:** 6 hours  
**Risk:** Medium  
**Files:**
- `src/bot/utils/rateLimiter.ts` (refactor)
- New: Redis-based rate limiter

#### Implementation Steps

1. **Create rate limiter interface:**

```typescript
// src/shared/rate-limit/types.ts
export interface RateLimiter {
    check(userId: string, guildId: string | null, commandName: string): Promise<RateLimitResult>;
    reset(userId: string, guildId: string | null): Promise<void>;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfter?: number;
}
```

2. **Create Redis rate limiter:**

```typescript
// src/shared/rate-limit/redis-rate-limiter.ts
import { Redis } from 'ioredis';
import { RateLimiter, RateLimitResult } from './types';

export class RedisRateLimiter implements RateLimiter {
    private redis: Redis;
    
    constructor(redisUrl: string) {
        this.redis = new Redis(redisUrl);
    }
    
    async check(
        userId: string,
        guildId: string | null,
        commandName: string
    ): Promise<RateLimitResult> {
        const key = `ratelimit:${userId}:${guildId || 'dm'}:${commandName}`;
        const windowMs = this.getWindowForCommand(commandName);
        const maxRequests = this.getMaxForCommand(commandName);
        
        const now = Date.now();
        const windowStart = now - windowMs;
        
        // Remove old entries
        await this.redis.zremrangebyscore(key, 0, windowStart);
        
        // Count current requests
        const count = await this.redis.zcard(key);
        
        if (count >= maxRequests) {
            const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
            const resetAt = parseInt(oldest[1]) + windowMs;
            
            return {
                allowed: false,
                remaining: 0,
                resetAt,
                retryAfter: Math.ceil((resetAt - now) / 1000)
            };
        }
        
        // Add current request
        await this.redis.zadd(key, now, `${now}-${Math.random()}`);
        await this.redis.pexpire(key, windowMs);
        
        return {
            allowed: true,
            remaining: maxRequests - count - 1,
            resetAt: now + windowMs
        };
    }
    
    async reset(userId: string, guildId: string | null): Promise<void> {
        const pattern = `ratelimit:${userId}:${guildId || 'dm'}:*`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
            await this.redis.del(...keys);
        }
    }
    
    private getWindowForCommand(commandName: string): number {
        if (['rank', 'leaderboard'].includes(commandName)) return 60000;
        if (['setup', 'config', 'welcome', 'boost', 'verify'].includes(commandName)) return 60000;
        return 60000;
    }
    
    private getMaxForCommand(commandName: string): number {
        if (['rank', 'leaderboard'].includes(commandName)) return 5;
        if (['setup', 'config', 'welcome', 'boost', 'verify'].includes(commandName)) return 20;
        return 10;
    }
}
```

3. **Create factory:**

```typescript
// src/shared/rate-limit/factory.ts
import { RateLimiter } from './types';
import { MemoryRateLimiter } from './memory-rate-limiter';
import { RedisRateLimiter } from './redis-rate-limiter';

export function createRateLimiter(): RateLimiter {
    if (process.env.REDIS_URL) {
        return new RedisRateLimiter(process.env.REDIS_URL);
    }
    return new MemoryRateLimiter();
}
```

4. **Update bot to use async rate limiting:**

```typescript
// In interactionCreate.ts or command handler
const rateLimiter = createRateLimiter();

const rateLimitResult = await rateLimiter.check(
    interaction.user.id,
    interaction.guildId,
    commandName
);

if (!rateLimitResult.allowed) {
    await interaction.reply({
        content: formatRateLimitMessage(rateLimitResult),
        ephemeral: true
    });
    return;
}
```

---

### Task 3.2: Add Cache Cleanup Jobs

**Priority:** P2  
**Effort:** 4 hours  
**Risk:** Low  
**Files:**
- `src/bot/jobs/cleanupUserCache.ts` (enhance)
- `src/dashboard/lib/discord-user-cache.ts` (add cleanup)

#### Implementation Steps

1. **Enhance user cache cleanup:**

```typescript
// src/bot/jobs/cleanupUserCache.ts
import cron from 'node-cron';
import { db } from '../../shared/database/client';
import { discordUserCache } from '../../shared/database/schema';
import { lt } from 'drizzle-orm';
import logger from '../utils/logger';

const CLEANUP_INTERVAL = '0 2 * * *'; // Daily at 2 AM
const CACHE_MAX_AGE_DAYS = 30;

export default function startUserCacheCleanupJob() {
    cron.schedule(CLEANUP_INTERVAL, async () => {
        logger.info('Starting user cache cleanup...');
        
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - CACHE_MAX_AGE_DAYS);
            
            const result = await db.delete(discordUserCache)
                .where(lt(discordUserCache.updatedAt, cutoffDate))
                .returning({ count: sql`count(*)` });
            
            logger.info(`Cleaned up ${result.length} old user cache entries`);
        } catch (error) {
            logger.error('User cache cleanup failed:', error);
        }
    });
}
```

2. **Add memory cache cleanup:**

```typescript
// Add to existing caches in messageCreate.ts, discord-cache.ts, etc.

// Periodic cleanup of expired entries
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of cache.entries()) {
        if (entry.expiresAt <= now) {
            cache.delete(key);
            cleaned++;
        }
    }
    
    if (cleaned > 0) {
        logger.debug(`Cleaned ${cleaned} expired cache entries`);
    }
}, 60000); // Every minute
```

---

### Task 3.3: Optimize Frontend Re-renders

**Priority:** P2  
**Effort:** 4 hours  
**Risk:** Low  
**File:** `src/dashboard/app/dashboard/[guildId]/analytics/page.tsx`

#### Implementation Steps

1. **Memoize expensive calculations:**

```typescript
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";

export default function AnalyticsPage() {
    // ... existing state

    // 🎯 Memoize heatmap matrix calculation
    const heatmapMatrix = useMemo(() => {
        if (!heatmapData.length) return [];
        
        const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
        heatmapData.forEach((h: any) => {
            if (matrix[h.day] && matrix[h.day][h.hour] !== undefined) {
                matrix[h.day][h.hour] += h.count;
            }
        });
        return matrix;
    }, [heatmapData]);

    // 🎯 Memoize max calculation
    const maxHeatmapValue = useMemo(() => {
        if (!heatmapMatrix.length) return 1;
        return Math.max(...heatmapMatrix.flat()) || 1;
    }, [heatmapMatrix]);

    // 🎯 Memoize fetch function
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/analytics`);
            if (res.ok) {
                const data = await res.json();
                if (data.stats) setStats(data.stats);
                if (data.heatmap) setHeatmapData(data.heatmap);
                if (data.leaderboard) setLeaderboard(data.leaderboard);
            }
        } catch (error) {
            console.error("Failed to fetch analytics:", error);
        } finally {
            setLoading(false);
        }
    }, [guildId]); // Only recreate when guildId changes

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ... rest of component
}
```

2. **Extract components to prevent unnecessary re-renders:**

```typescript
// Create separate components
function HeatmapCell({ count, max, hourIndex }: { count: number; max: number; hourIndex: number }) {
    const intensity = count > 0 ? 0.3 + (0.7 * (count / max)) : 0.05;
    
    return (
        <div
            className="aspect-square rounded-sm transition-all hover:ring-2 ring-primary/50 cursor-help"
            style={{ backgroundColor: `hsl(var(--primary) / ${intensity})` }}
            title={`${count} messages at ${hourIndex}:00`}
        />
    );
}

function HeatmapRow({ dayData, dayIndex, max }: { dayData: number[]; dayIndex: number; max: number }) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
    return (
        <div className="flex items-center">
            <div className="w-10 text-xs text-muted-foreground font-medium">
                {days[dayIndex]}
            </div>
            <div className="flex-1 grid grid-cols-24 gap-0.5 min-w-[500px]">
                {dayData.map((count, hourIndex) => (
                    <HeatmapCell 
                        key={hourIndex} 
                        count={count} 
                        max={max} 
                        hourIndex={hourIndex} 
                    />
                ))}
            </div>
        </div>
    );
}
```

---

### Task 3.4: Cache Message Templates

**Priority:** P2  
**Effort:** 3 hours  
**Risk:** Low  
**File:** `src/bot/events/guildMemberUpdate.ts`

#### Implementation Steps

1. **Add message template cache:**

```typescript
// At top of guildMemberUpdate.ts
interface TemplateCacheEntry {
    templates: Map<string, typeof messageTemplate.$inferSelect>;
    expiresAt: number;
}

const templateCache = new Map<string, TemplateCacheEntry>();
const TEMPLATE_CACHE_TTL_MS = 300_000; // 5 minutes

async function getCachedTemplates(guildId: string): Promise<Map<string, typeof messageTemplate.$inferSelect>> {
    const cached = templateCache.get(guildId);
    const now = Date.now();
    
    if (cached && cached.expiresAt > now) {
        return cached.templates;
    }
    
    // Fetch all templates for guild
    const templates = await db.query.messageTemplate.findMany({
        where: eq(messageTemplate.guildId, guildId)
    });
    
    const templateMap = new Map(templates.map(t => [t.id, t]));
    
    templateCache.set(guildId, {
        templates: templateMap,
        expiresAt: now + TEMPLATE_CACHE_TTL_MS
    });
    
    return templateMap;
}

export function invalidateTemplateCache(guildId: string): void {
    templateCache.delete(guildId);
}
```

2. **Update welcome trigger processing:**

```typescript
// In the role update handler
const templates = await getCachedTemplates(newMember.guild.id);

for (const { trigger, templateId } of triggerRows) {
    const template = templates.get(templateId);
    if (!template) continue;
    
    await sendWelcomeMessage(newMember, trigger, template);
}
```

---

## Phase 4: Database Optimization (Days 11-15)

### Task 4.1: Add Missing Indexes

**Priority:** P2  
**Effort:** 3 hours  
**Risk:** Low (but monitor disk usage)  
**File:** `src/shared/database/schema.ts`, migration files

#### Implementation Steps

1. **Add GIN index for metadata queries:**

```typescript
// In actionLog table definition
export const actionLog = pgTable('action_log', {
    // ... existing columns
}, (table) => ({
    guildTypeIdx: index('action_log_guild_type_idx').on(table.guildId, table.actionType),
    guildExecutedIdx: index('action_log_guild_executed_idx').on(table.guildId, table.executedAt),
    guildTypeExecutedIdx: index('action_log_guild_type_executed_idx').on(table.guildId, table.actionType, table.executedAt),
    // 🎯 New: GIN index for metadata queries
    metadataGinIdx: index('action_log_metadata_gin_idx')
        .on(sql`${table.metadata} jsonb_path_ops`),
}));
```

2. **Add index for notification dedupe:**

```typescript
// In notificationEvent table
export const notificationEvent = pgTable('notification_event', {
    // ... existing columns
}, (table) => ({
    // ... existing indexes
    // 🎯 New: Covering index for dedupe queries
    guildDedupeCoveringIdx: index('notification_event_guild_dedupe_covering_idx')
        .on(table.guildId, table.dedupeKey, table.occurredAt),
}));
```

3. **Generate and run migration:**

```bash
npm run db:generate
npm run db:push
```

4. **Analyze query performance:**

```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename IN ('action_log', 'notification_event')
ORDER BY idx_scan DESC;
```

---

### Task 4.2: Implement Pagination for Large Queries

**Priority:** P2  
**Effort:** 6 hours  
**Risk:** Medium (requires frontend changes)  
**Files:**
- Birthday job
- Analytics endpoints
- Dashboard pages

#### Implementation Steps

1. **Update birthday job with pagination:**

```typescript
// In checkBirthdays.ts
const BATCH_SIZE = 50;

export async function checkBirthdays(client: Client) {
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
        const configs = await db.query.birthdayConfig.findMany({
            where: eq(birthdayConfig.enabled, true),
            limit: BATCH_SIZE,
            offset
        });
        
        if (configs.length === 0) {
            hasMore = false;
            break;
        }
        
        // Process batch
        for (const config of configs) {
            await processBirthdayConfig(config, client);
        }
        
        offset += BATCH_SIZE;
        
        // Small delay between batches
        if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
}
```

2. **Add cursor-based pagination for logs:**

```typescript
// In logs API route
export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    // ... auth check
    
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    
    let query = db.select()
        .from(actionLog)
        .where(eq(actionLog.guildId, guildId))
        .orderBy(desc(actionLog.executedAt))
        .limit(limit);
    
    if (cursor) {
        const cursorDate = new Date(atob(cursor));
        query = query.where(lt(actionLog.executedAt, cursorDate));
    }
    
    const logs = await query;
    
    const nextCursor = logs.length === limit 
        ? btoa(logs[logs.length - 1].executedAt.toISOString())
        : null;
    
    return NextResponse.json({
        logs,
        pagination: {
            nextCursor,
            hasMore: !!nextCursor
        }
    });
}
```

---

### Task 4.3: Add Batch Processing

**Priority:** P2  
**Effort:** 5 hours  
**Risk:** Medium  
**Files:** Various job files

#### Implementation Steps

1. **Create batch processing utility:**

```typescript
// src/shared/utils/batch-processor.ts
export interface BatchProcessorOptions<T, R> {
    items: T[];
    batchSize: number;
    processBatch: (batch: T[]) => Promise<R[]>;
    onProgress?: (completed: number, total: number) => void;
    delayBetweenBatches?: number;
}

export async function processInBatches<T, R>(
    options: BatchProcessorOptions<T, R>
): Promise<R[]> {
    const { items, batchSize, processBatch, onProgress, delayBetweenBatches } = options;
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await processBatch(batch);
        results.push(...batchResults);
        
        if (onProgress) {
            onProgress(Math.min(i + batchSize, items.length), items.length);
        }
        
        if (delayBetweenBatches && i + batchSize < items.length) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
    }
    
    return results;
}
```

2. **Apply to analytics sync:**

```typescript
// In syncAnalytics.ts
import { processInBatches } from '../../shared/utils/batch-processor';

const results = await processInBatches({
    items: members,
    batchSize: CHUNK_SIZE,
    processBatch: async (batch) => {
        await db.insert(userJoin)
            .values(batch)
            .onConflictDoUpdate({...});
        return batch;
    },
    delayBetweenBatches: 50
});
```

---

## Phase 5: Monitoring & Infrastructure (Days 14-17)

### Task 5.1: Add Performance Metrics

**Priority:** P2  
**Effort:** 6 hours  
**Risk:** Low  
**Files:** New monitoring module

#### Implementation Steps

1. **Create metrics collection:**

```typescript
// src/shared/metrics/index.ts
import { Counter, Histogram, Gauge, register } from 'prom-client';

// Database metrics
export const dbQueryDuration = new Histogram({
    name: 'db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['operation', 'table'],
    buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.5, 1, 2]
});

export const dbQueryErrors = new Counter({
    name: 'db_query_errors_total',
    help: 'Total number of database query errors',
    labelNames: ['operation', 'error_type']
});

// Discord API metrics
export const discordApiRequests = new Counter({
    name: 'discord_api_requests_total',
    help: 'Total Discord API requests',
    labelNames: ['method', 'endpoint', 'status']
});

export const discordApiDuration = new Histogram({
    name: 'discord_api_duration_seconds',
    help: 'Discord API request duration',
    labelNames: ['method', 'endpoint'],
    buckets: [0.1, 0.5, 1, 2, 5]
});

// Bot metrics
export const commandsExecuted = new Counter({
    name: 'bot_commands_executed_total',
    help: 'Total commands executed',
    labelNames: ['command', 'guild_id']
});

export const eventsProcessed = new Counter({
    name: 'bot_events_processed_total',
    help: 'Total events processed',
    labelNames: ['event_type']
});

// Cache metrics
export const cacheHits = new Counter({
    name: 'cache_hits_total',
    help: 'Total cache hits',
    labelNames: ['cache_name']
});

export const cacheMisses = new Counter({
    name: 'cache_misses_total',
    help: 'Total cache misses',
    labelNames: ['cache_name']
});

// Export metrics endpoint
export async function getMetrics(): Promise<string> {
    return register.metrics();
}
```

2. **Instrument database queries:**

```typescript
// Wrapper for database operations
export async function instrumentedQuery<T>(
    operation: string,
    table: string,
    queryFn: () => Promise<T>
): Promise<T> {
    const end = dbQueryDuration.startTimer();
    try {
        const result = await queryFn();
        end({ operation, table });
        return result;
    } catch (error) {
        dbQueryErrors.inc({ operation, error_type: error instanceof Error ? error.name : 'unknown' });
        throw error;
    }
}
```

3. **Add metrics endpoint to dashboard:**

```typescript
// src/dashboard/app/api/metrics/route.ts
import { NextResponse } from 'next/server';
import { getMetrics } from '@shared/metrics';

export async function GET() {
    const metrics = await getMetrics();
    return new NextResponse(metrics, {
        headers: {
            'Content-Type': 'text/plain'
        }
    });
}
```

---

### Task 5.2: Implement Alerting

**Priority:** P2  
**Effort:** 4 hours  
**Risk:** Low  
**Files:** Alerting configuration

#### Implementation Steps

1. **Create alerting rules:**

```yaml
# alerting-rules.yml
groups:
  - name: ixoye-alerts
    rules:
      - alert: HighDatabaseQueryDuration
        expr: histogram_quantile(0.95, db_query_duration_seconds) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database query duration"
          
      - alert: DiscordAPIErrors
        expr: rate(discord_api_requests_total{status=~"5.."}[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
          
      - alert: LowCacheHitRate
        expr: |
          (
            rate(cache_hits_total[5m]) /
            (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))
          ) < 0.5
        for: 10m
        labels:
          severity: warning
```

2. **Add health check endpoint:**

```typescript
// src/dashboard/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { checkPoolHealth } from '@shared/database/client';

export async function GET() {
    const checks = await Promise.all([
        checkDatabase(),
        checkDiscordConnection(),
        checkMemoryUsage()
    ]);
    
    const healthy = checks.every(c => c.healthy);
    
    return NextResponse.json(
        {
            status: healthy ? 'healthy' : 'unhealthy',
            checks: checks.reduce((acc, check) => ({
                ...acc,
                [check.name]: {
                    healthy: check.healthy,
                    responseTime: check.responseTime,
                    message: check.message
                }
            }), {})
        },
        { status: healthy ? 200 : 503 }
    );
}
```

---

### Task 5.3: Add Load Testing

**Priority:** P2  
**Effort:** 6 hours  
**Risk:** Low  
**Files:** Test scripts

#### Implementation Steps

1. **Create k6 load tests:**

```javascript
// load-tests/discord-api-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 0 }
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'],
        http_req_failed: ['rate<0.01']
    }
};

export default function () {
    const res = http.get(`${__ENV.BASE_URL}/api/guilds/${__ENV.GUILD_ID}/analytics`);
    
    check(res, {
        'status is 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500
    });
    
    sleep(1);
}
```

2. **Create bot load simulation:**

```typescript
// load-tests/bot-message-flood.ts
// Simulates high message volume for testing

const TEST_GUILD_ID = process.env.TEST_GUILD_ID;
const MESSAGE_RATE_PER_SECOND = 100;

async function simulateMessageFlood(durationSeconds: number) {
    const startTime = Date.now();
    let messagesSent = 0;
    
    const interval = setInterval(async () => {
        // Send burst of messages
        for (let i = 0; i < MESSAGE_RATE_PER_SECOND; i++) {
            await simulateMessage(TEST_GUILD_ID);
            messagesSent++;
        }
        
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed >= durationSeconds) {
            clearInterval(interval);
            console.log(`Sent ${messagesSent} messages in ${elapsed}s`);
        }
    }, 1000);
}
```

---

### Task 5.4: Documentation & Runbooks

**Priority:** P2  
**Effort:** 4 hours  
**Risk:** None  
**Files:** Documentation

#### Implementation Steps

1. **Create operations runbook:**

```markdown
# ΙΧΘΥΣ Operations Runbook

## Performance Issues

### High Database Load
**Symptoms:** Slow queries, high CPU on DB
**Diagnosis:**
```sql
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```
**Resolution:**
1. Check for N+1 queries in logs
2. Review slow query log
3. Consider read replicas if read-heavy

### Bot Response Lag
**Symptoms:** Commands taking >3s to respond
**Diagnosis:**
- Check event loop lag: `process.hrtime()`
- Monitor Discord API rate limits
- Check memory usage

**Resolution:**
1. Restart bot if memory leak suspected
2. Scale horizontally if CPU-bound
3. Enable more aggressive caching

### Dashboard Slow
**Symptoms:** API responses >500ms
**Resolution:**
1. Check database connection pool
2. Review cache hit rates
3. Scale Next.js instances
```

---

## Testing Checklist

### Unit Tests
- [ ] Rate limiting logic
- [ ] Cache expiration
- [ ] Batch processing
- [ ] Regex compilation

### Integration Tests
- [ ] Voice XP job with 1000+ profiles
- [ ] Auto-moderation with 100 banned words
- [ ] Dashboard API under concurrent load
- [ ] Reaction roles with 50+ roles

### Load Tests
- [ ] 1000 messages/minute
- [ ] 100 concurrent dashboard users
- [ ] 1000 active voice users
- [ ] Birthday job with 500 guilds

### Monitoring Verification
- [ ] Metrics are collected
- [ ] Alerts fire correctly
- [ ] Dashboard shows data
- [ ] Health checks pass

---

## Deployment Plan

### Week 1: Critical Fixes
```
Day 1-2: Task 1.1 (N+1 queries)
Day 2-3: Task 1.2 (Regex compilation)
Day 3-4: Task 1.3 (Alias limits)
Day 4-5: Task 1.4 (Reaction roles)
Day 5: Testing & validation
```

### Week 2: API Hardening & Caching
```
Day 6-7: Task 2.1 (API rate limiting)
Day 7-8: Task 2.2 & 2.3 (Timeouts & monitoring)
Day 9-10: Task 3.1-3.2 (Caching improvements)
Day 11-12: Task 3.3-3.4 (Frontend optimization)
```

### Week 3: Database & Monitoring
```
Day 13-14: Task 4.1-4.3 (Database optimization)
Day 15-16: Task 5.1-5.2 (Metrics & alerting)
Day 16-17: Task 5.3-5.4 (Testing & docs)
```

### Rollback Strategy
Each task includes:
1. Feature flags where applicable
2. Original code commented out
3. Monitoring for 24h post-deployment
4. Automated rollback triggers

---

## Success Metrics

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| Voice XP job duration | ~30s | <10s | Logs |
| DB queries/job run | 1000+ | <100 | Query logs |
| API p95 response time | 800ms | <300ms | Metrics |
| Cache hit rate | ~60% | >85% | Metrics |
| Memory usage growth | Unbounded | Stable | Monitoring |
| Regex compilation/min | 50000 | <100 | Profiling |

---

## Conclusion

This plan addresses all critical and high-priority performance issues in a structured, low-risk manner. Each phase builds upon the previous, with clear testing and rollback strategies. The estimated 40-60% performance improvement should be achievable within the 3-week timeline.

**Next Steps:**
1. Review and approve plan
2. Set up feature flags for risky changes
3. Begin Phase 1 implementation
4. Schedule daily standups during implementation
5. Set up monitoring before any changes
