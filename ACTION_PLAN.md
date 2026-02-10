# ΙΧΘΥΣ Action Plan

**Priority:** Critical Fixes & Improvements  
**Timeline:** 4 Weeks

---

## Week 1: Critical Security & Stability

### 1.1 Add Guild Permission Validation

**Priority:** P0 (Critical)  
**Files:** All dashboard API routes

**Issue:** API routes only check if user is logged in, not if they have permission to manage the guild.

**Solution:** Create a shared validation helper.

```typescript
// src/dashboard/lib/permissions.ts
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

const MANAGE_GUILD = 0x20;

export async function validateGuildAccess(
    req: Request, 
    guildId: string
): Promise<{ valid: boolean; error?: string; status?: number }> {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
        return { valid: false, error: "Unauthorized", status: 401 };
    }
    
    if (!session.accessToken) {
        return { valid: false, error: "No access token", status: 401 };
    }
    
    try {
        // Fetch user's guilds from Discord
        const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
            headers: { Authorization: `Bearer ${session.accessToken}` },
        });
        
        if (!response.ok) {
            return { valid: false, error: "Failed to fetch guilds", status: 500 };
        }
        
        const guilds = await response.json();
        const guild = guilds.find((g: any) => g.id === guildId);
        
        if (!guild) {
            return { valid: false, error: "Guild not found", status: 404 };
        }
        
        const permissions = BigInt(guild.permissions);
        const hasManage = guild.owner || (permissions & BigInt(MANAGE_GUILD)) !== BigInt(0);
        
        if (!hasManage) {
            return { valid: false, error: "Missing Manage Server permission", status: 403 };
        }
        
        return { valid: true };
    } catch (error) {
        console.error("Error validating guild access:", error);
        return { valid: false, error: "Internal error", status: 500 };
    }
}
```

**Update all API routes:**

```typescript
// Example: src/dashboard/app/api/guilds/[guildId]/welcome/config/route.ts
import { validateGuildAccess } from "@/lib/permissions";

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const validation = await validateGuildAccess(req, params.guildId);
    
    if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: validation.status });
    }
    
    // Continue with request...
}
```

---

### 1.2 Add Input Validation with Zod

**Priority:** P0 (Critical)  
**Files:** All dashboard API routes

**Install Zod:**
```bash
bun add zod
```

**Create validation schemas:**

```typescript
// src/dashboard/lib/validation.ts
import { z } from "zod";

// Common schemas
const snowflake = z.string().regex(/^\d{17,20}$/, "Invalid Discord ID");

export const guildIdSchema = z.object({
    guildId: snowflake,
});

export const welcomeConfigSchema = z.object({
    welcomeEnabled: z.boolean(),
    autoRoleId: snowflake.nullable().optional(),
    joinMessageChannelId: snowflake.nullable().optional(),
    joinMessage: z.string().max(2000).nullable().optional(),
    joinMessageEmbed: z.record(z.any()).nullable().optional(),
    leaveMessageChannelId: snowflake.nullable().optional(),
    leaveMessage: z.string().max(2000).nullable().optional(),
    leaveMessageEmbed: z.record(z.any()).nullable().optional(),
});

export const templateSchema = z.object({
    name: z.string().min(1).max(100),
    content: z.string().max(2000),
    embedEnabled: z.boolean().default(false),
    embedData: z.record(z.any()).optional(),
});

export const triggerSchema = z.object({
    roleId: snowflake,
    templateId: z.string().uuid(),
    channelId: snowflake.nullable().optional(),
    enabled: z.boolean().default(true),
});

export const levelingConfigSchema = z.object({
    levelingEnabled: z.boolean(),
    textXpMin: z.number().int().min(1).max(100).default(15),
    textXpMax: z.number().int().min(1).max(100).default(25),
    textXpCooldown: z.number().int().min(1).max(3600).default(60),
    voiceXpPerMinute: z.number().int().min(1).max(100).default(10),
    levelUpNotifEnabled: z.boolean().default(true),
    levelUpChannelId: snowflake.nullable().optional(),
    levelUpMessage: z.string().max(2000).nullable().optional(),
    levelUpMessageEmbed: z.record(z.any()).nullable().optional(),
});

export const verificationConfigSchema = z.object({
    verificationEnabled: z.boolean(),
    unverifiedRoleId: snowflake.nullable().optional(),
    verificationRoleId: snowflake.nullable().optional(),
    verificationGraceDays: z.number().int().min(1).max(365).default(30),
    verificationKickDmEnabled: z.boolean().default(true),
    verificationMessage: z.string().max(2000).nullable().optional(),
});

export const boostConfigSchema = z.object({
    boostEnabled: z.boolean(),
    boostAnnouncementChannelId: snowflake.nullable().optional(),
    boostRoleId: snowflake.nullable().optional(),
    boostRoleName: z.string().max(100).nullable().optional(),
    boostRoleColorPrimary: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
    boostRoleColorSecondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
    boostClaimRequired: z.boolean().default(true),
    boostWelcomeMessage: z.string().max(2000).nullable().optional(),
    boostWelcomeMessageEmbed: z.record(z.any()).nullable().optional(),
    boostReBoostMessage: z.string().max(2000).nullable().optional(),
    boostReBoostMessageEmbed: z.record(z.any()).nullable().optional(),
    boostRoleRemovalDays: z.number().int().min(0).max(365).default(30),
    boostRoleRemovalDmEnabled: z.boolean().default(true),
});

export const roleActionSchema = z.object({
    id: z.string().uuid().optional(),
    roleId: snowflake,
    triggerType: z.enum(["ADD", "REMOVE"]).default("ADD"),
    actionType: z.enum(["DM", "KICK", "LOG", "MSG"]),
    actionGroup: z.string().max(50).optional().nullable(),
    actionDelay: z.number().int().min(0).max(10080).default(0), // Max 1 week
    dmMessage: z.string().max(2000).optional().nullable(),
    dmMessageEmbed: z.record(z.any()).optional().nullable(),
    channelId: snowflake.optional().nullable(),
    kickReason: z.string().max(512).optional().nullable(),
    logChannelId: snowflake.optional().nullable(),
    enabled: z.boolean().default(true),
});
```

**Usage in API routes:**

```typescript
export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    
    // Validate guildId
    const guildResult = guildIdSchema.safeParse(params);
    if (!guildResult.success) {
        return NextResponse.json({ error: "Invalid guild ID" }, { status: 400 });
    }
    
    // Parse and validate body
    const body = await req.json();
    const result = welcomeConfigSchema.safeParse(body);
    
    if (!result.success) {
        return NextResponse.json({ 
            error: "Invalid input", 
            details: result.error.errors 
        }, { status: 400 });
    }
    
    // Continue with validated data: result.data
}
```

---

### 1.3 Add Rate Limiting

**Priority:** P0 (Critical)  
**Files:** Dashboard API routes

**Install package:**
```bash
bun add @upstash/ratelimit @upstash/redis
```

**Create rate limiter:**

```typescript
// src/dashboard/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// For local development without Redis, use memory
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || "",
    token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

// Different limits for different endpoints
export const strictLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"), // 5 requests per minute
    analytics: true,
});

export const standardLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"), // 30 requests per minute
    analytics: true,
});

export const generousLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1 m"), // 100 requests per minute
    analytics: true,
});

// Fallback for development (in-memory)
const memoryCache = new Map<string, { count: number; resetTime: number }>();

export async function checkRateLimit(
    identifier: string, 
    maxRequests: number = 30,
    windowMs: number = 60000
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
    // Use Redis if available, otherwise memory
    if (process.env.UPSTASH_REDIS_REST_URL) {
        const limiter = new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs} ms`),
        });
        return await limiter.limit(identifier);
    }
    
    // Memory fallback
    const now = Date.now();
    const key = `${identifier}:${Math.floor(now / windowMs)}`;
    const existing = memoryCache.get(key);
    
    if (!existing) {
        memoryCache.set(key, { count: 1, resetTime: now + windowMs });
        return { success: true, limit: maxRequests, remaining: maxRequests - 1, reset: now + windowMs };
    }
    
    if (existing.count >= maxRequests) {
        return { success: false, limit: maxRequests, remaining: 0, reset: existing.resetTime };
    }
    
    existing.count++;
    return { success: true, limit: maxRequests, remaining: maxRequests - existing.count, reset: existing.resetTime };
}
```

**Apply to API routes:**

```typescript
import { checkRateLimit } from "@/lib/rate-limit";
import { getServerSession } from "next-auth";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Rate limit by user ID
    const rateLimit = await checkRateLimit(`api:post:${session.user.id}`, 10, 60000);
    
    if (!rateLimit.success) {
        return NextResponse.json(
            { error: "Rate limit exceeded" }, 
            { status: 429, headers: { "X-RateLimit-Reset": String(rateLimit.reset) } }
        );
    }
    
    // Continue with request...
}
```

---

### 1.4 Fix Logger Consistency

**Priority:** P1 (High)  
**Files:** Dashboard API routes

**Create dashboard logger:**

```typescript
// src/dashboard/lib/logger.ts
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";

const isDevelopment = process.env.NODE_ENV === "development";

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: "ixoye-dashboard" },
    transports: [
        // Console for development
        new winston.transports.Console({
            format: isDevelopment 
                ? winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple()
                  )
                : winston.format.json(),
        }),
        // Rotating file for production
        new DailyRotateFile({
            filename: path.join("logs", "dashboard-error-%DATE%.log"),
            datePattern: "YYYY-MM-DD",
            zippedArchive: true,
            maxSize: "20m",
            maxFiles: "14d",
            level: "error",
        }),
        new DailyRotateFile({
            filename: path.join("logs", "dashboard-combined-%DATE%.log"),
            datePattern: "YYYY-MM-DD",
            zippedArchive: true,
            maxSize: "20m",
            maxFiles: "14d",
        }),
    ],
});

export default logger;
```

**Replace console.error in API routes:**

```typescript
// Before
console.error("Error fetching config:", error);

// After  
import logger from "@/lib/logger";
logger.error("Error fetching config", { error, guildId, userId: session.user.id });
```

---

## Week 2: Missing Features

### 2.1 Implement Logs Page

**Priority:** P1 (High)  
**New File:** `src/dashboard/app/dashboard/[guildId]/logs/page.tsx`

**Create API route:**

```typescript
// src/dashboard/app/api/guilds/[guildId]/logs/route.ts
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { actionLog } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { validateGuildAccess } from "@/lib/permissions";
import logger from "@/lib/logger";

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const { guildId } = params;
    
    // Validate access
    const validation = await validateGuildAccess(req, guildId);
    if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: validation.status });
    }
    
    // Get pagination params
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = (page - 1) * limit;
    
    try {
        const logs = await db.query.actionLog.findMany({
            where: eq(actionLog.guildId, guildId),
            orderBy: [desc(actionLog.executedAt)],
            limit,
            offset,
        });
        
        // Fetch user info for each log
        const enrichedLogs = await Promise.all(
            logs.map(async (log) => {
                try {
                    const userRes = await fetch(
                        `https://discord.com/api/v10/users/${log.targetUserId}`,
                        { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` } }
                    );
                    if (userRes.ok) {
                        const user = await userRes.json();
                        return {
                            ...log,
                            targetUsername: user.global_name || user.username,
                            targetAvatar: user.avatar,
                        };
                    }
                } catch (e) {
                    // Ignore fetch errors
                }
                return {
                    ...log,
                    targetUsername: `User ${log.targetUserId.slice(-4)}`,
                    targetAvatar: null,
                };
            })
        );
        
        return NextResponse.json({
            logs: enrichedLogs,
            pagination: { page, limit, offset },
        });
    } catch (error) {
        logger.error("Error fetching action logs", { error, guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
```

**Create page component:**

```typescript
// src/dashboard/app/dashboard/[guildId]/logs/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardHeader, CardContent, CardTitle } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { ScrollText, ChevronLeft, ChevronRight, CheckCircle, XCircle } from "lucide-react";

interface ActionLog {
    id: string;
    actionType: string;
    targetUserId: string;
    targetUsername: string;
    targetAvatar: string | null;
    executedAt: string;
    success: boolean;
    errorMessage: string | null;
    metadata: string | null;
}

export default function LogsPage() {
    const params = useParams();
    const guildId = params.guildId as string;
    const [logs, setLogs] = useState<ActionLog[]>([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);

    const fetchLogs = async (pageNum: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/logs?page=${pageNum}&limit=50`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs);
                setHasMore(data.logs.length === 50);
            }
        } catch (error) {
            console.error("Failed to fetch logs:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs(page);
    }, [guildId, page]);

    const getActionColor = (type: string) => {
        switch (type) {
            case "KICK": return "bg-red-500";
            case "DM": return "bg-blue-500";
            case "MSG": return "bg-purple-500";
            case "LOG": return "bg-green-500";
            case "BOOST_ROLE_REMOVED": return "bg-orange-500";
            default: return "bg-gray-500";
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-5xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Action Logs</h1>
                <p className="text-muted-foreground">History of automated actions performed by the bot.</p>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <ScrollText className="h-5 w-5" />
                        Recent Actions
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1 || loading}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-muted-foreground">Page {page}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => p + 1)}
                            disabled={!hasMore || loading}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading...</div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No actions recorded yet.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {logs.map((log) => (
                                <div
                                    key={log.id}
                                    className="flex items-center justify-between p-4 rounded-lg border"
                                >
                                    <div className="flex items-center gap-4">
                                        {log.targetAvatar ? (
                                            <img
                                                src={`https://cdn.discordapp.com/avatars/${log.targetUserId}/${log.targetAvatar}.png`}
                                                alt=""
                                                className="h-10 w-10 rounded-full"
                                            />
                                        ) : (
                                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                                {log.targetUsername?.charAt(0) || "?"}
                                            </div>
                                        )}
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Badge className={getActionColor(log.actionType)}>
                                                    {log.actionType}
                                                </Badge>
                                                {log.success ? (
                                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                                ) : (
                                                    <XCircle className="h-4 w-4 text-red-500" />
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Target: {log.targetUsername}
                                            </p>
                                            {log.errorMessage && (
                                                <p className="text-xs text-red-500">
                                                    Error: {log.errorMessage}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(log.executedAt).toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
```

---

### 2.2 Complete Growth Analytics

**Priority:** P1 (High)  
**Files:** Analytics API and storage

**Add growth tracking table:**

```typescript
// Add to src/shared/database/schema.ts
export const guildGrowth = sqliteTable('guild_growth', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    date: integer('date', { mode: 'timestamp' }).notNull(),
    memberCount: integer('member_count').notNull(),
    verifiedCount: integer('verified_count').default(0).notNull(),
    joinedToday: integer('joined_today').default(0).notNull(),
    leftToday: integer('left_today').default(0).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    guildDateIdx: uniqueIndex('guild_growth_guild_date_unique').on(table.guildId, table.date),
    guildIdIdx: index('guild_growth_guild_id_idx').on(table.guildId),
}));
```

**Create growth tracking job:**

```typescript
// src/bot/jobs/trackGrowth.ts
import cron from "node-cron";
import { db } from "../../shared/database/client";
import { guildGrowth, userJoin, guildConfig } from "../../shared/database/schema";
import { eq, and, gte } from "drizzle-orm";
import client from "../client";
import logger from "../utils/logger";

export default function startGrowthTrackingJob() {
    // Run daily at midnight
    cron.schedule("0 0 * * *", async () => {
        logger.info("Running daily growth tracking...");
        
        try {
            const configs = await db.select().from(guildConfig);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            for (const config of configs) {
                try {
                    const guild = client.guilds.cache.get(config.guildId);
                    if (!guild) continue;
                    
                    // Get member count
                    const memberCount = guild.memberCount;
                    
                    // Get verified count
                    const verifiedResult = await db
                        .select({ count: sql<number>`count(*)` })
                        .from(userJoin)
                        .where(and(
                            eq(userJoin.guildId, config.guildId),
                            eq(userJoin.isVerified, true)
                        ));
                    const verifiedCount = verifiedResult[0]?.count || 0;
                    
                    // Get joins today
                    const joinsResult = await db
                        .select({ count: sql<number>`count(*)` })
                        .from(userJoin)
                        .where(and(
                            eq(userJoin.guildId, config.guildId),
                            gte(userJoin.joinedAt, yesterday)
                        ));
                    const joinedToday = joinsResult[0]?.count || 0;
                    
                    // Get leaves (approximated from kickedAt)
                    const leavesResult = await db
                        .select({ count: sql<number>`count(*)` })
                        .from(userJoin)
                        .where(and(
                            eq(userJoin.guildId, config.guildId),
                            gte(userJoin.kickedAt, yesterday)
                        ));
                    const leftToday = leavesResult[0]?.count || 0;
                    
                    // Insert growth record
                    await db.insert(guildGrowth).values({
                        guildId: config.guildId,
                        date: today,
                        memberCount,
                        verifiedCount,
                        joinedToday,
                        leftToday,
                    }).onConflictDoUpdate({
                        target: [guildGrowth.guildId, guildGrowth.date],
                        set: {
                            memberCount,
                            verifiedCount,
                            joinedToday,
                            leftToday,
                        },
                    });
                    
                    logger.debug(`Tracked growth for ${guild.name}: ${memberCount} members`);
                } catch (error) {
                    logger.error(`Failed to track growth for guild ${config.guildId}:`, error);
                }
            }
            
            logger.info("Growth tracking completed");
        } catch (error) {
            logger.error("Error in growth tracking job:", error);
        }
    });
}
```

**Update analytics API:**

```typescript
// Add to analytics API route
const growthData = await db.select()
    .from(guildGrowth)
    .where(eq(guildGrowth.guildId, guildId))
    .orderBy(desc(guildGrowth.date))
    .limit(30);

return NextResponse.json({
    stats: { ... },
    heatmap: heatmapData,
    leaderboard: leaderboard,
    growth: growthData.reverse(), // Oldest first for chart
});
```

---

## Week 3: Type Safety & Performance

### 3.1 Enable Strict TypeScript

**Priority:** P2 (Medium)  
**Files:** `tsconfig.json`

```json
{
    "compilerOptions": {
        "strict": true,
        "noImplicitAny": true,
        "strictNullChecks": true,
        "strictFunctionTypes": true,
        "strictBindCallApply": true,
        "strictPropertyInitialization": true,
        "noImplicitThis": true,
        "alwaysStrict": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true,
        "noImplicitReturns": true,
        "noFallthroughCasesInSwitch": true
    }
}
```

### 3.2 Add Query Pagination

**Priority:** P2 (Medium)  
**Files:** Leaderboard, logs, large list endpoints

```typescript
// Add pagination helpers
export function getPaginationParams(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
    return { page, limit, offset: (page - 1) * limit };
}
```

---

## Week 4: Testing & Documentation

### 4.1 Add Basic Tests

**Priority:** P2 (Medium)

```bash
bun add -d vitest @vitest/ui
```

**Create test structure:**

```typescript
// src/bot/utils/__tests__/leveling.test.ts
import { describe, it, expect } from "vitest";
import { calculateLevel, calculateXpForLevel } from "../../utils/leveling";

describe("Leveling Utils", () => {
    describe("calculateLevel", () => {
        it("returns 0 for 0 XP", () => {
            expect(calculateLevel(0)).toBe(0);
        });
        
        it("returns 1 for 100 XP", () => {
            expect(calculateLevel(100)).toBe(1);
        });
        
        it("returns 10 for 10000 XP", () => {
            expect(calculateLevel(10000)).toBe(10);
        });
    });
    
    describe("calculateXpForLevel", () => {
        it("returns 100 for level 1", () => {
            expect(calculateXpForLevel(1)).toBe(100);
        });
        
        it("returns 10000 for level 10", () => {
            expect(calculateXpForLevel(10)).toBe(10000);
        });
    });
});
```

### 4.2 Update AGENTS.md

**Priority:** P2 (Medium)  
Update code examples to match actual patterns used in the codebase.

---

## Environment Variables

Add these new environment variables:

```bash
# Rate Limiting (optional, falls back to memory)
UPSTASH_REDIS_REST_URL=https://your-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token

# Logging
LOG_LEVEL=info

# Dashboard specific
NEXT_PUBLIC_DISCORD_CLIENT_ID=your_client_id
```

---

## Summary

### Week 1 Deliverables
- [ ] Guild permission validation helper
- [ ] Zod validation schemas
- [ ] Rate limiting middleware
- [ ] Dashboard logger

### Week 2 Deliverables
- [ ] Logs page UI
- [ ] Action logs API
- [ ] Growth tracking table
- [ ] Growth tracking job

### Week 3 Deliverables
- [ ] Strict TypeScript enabled
- [ ] All type errors fixed
- [ ] Pagination for large lists

### Week 4 Deliverables
- [ ] Unit tests for utilities
- [ ] Integration tests for APIs
- [ ] Documentation updated

---

**End of Action Plan**
