import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/guild-auth";
import logger from "@/lib/logger";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 120;
const MAX_RATE_LIMIT_KEYS = 3_000;

interface RateLimitEntry {
    count: number;
    resetAt: number;
    updatedAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

const searchSourceSchema = z.enum(["settings", "feature", "docs"]);

const telemetryPayloadSchema = z.object({
    event: z.enum(["search_open", "search_query", "search_select"]),
    mode: z.enum(["dashboard", "docs"]),
    guildId: z.string().regex(/^\d{17,20}$/).optional(),
    trigger: z.enum(["click", "focus", "shortcut", "mobile_button", "docs_button", "unknown"]).optional(),
    indexSize: z.number().int().min(0).max(5000).optional(),
    queryHash: z.string().regex(/^[a-f0-9]{8}$/).optional(),
    queryLength: z.number().int().min(0).max(200).optional(),
    tokenCount: z.number().int().min(0).max(20).optional(),
    resultCount: z.number().int().min(0).max(40).optional(),
    topSources: z.array(searchSourceSchema).max(3).optional(),
    selectedEntryId: z.string().min(1).max(220).optional(),
    selectedSource: searchSourceSchema.optional(),
    selectedRank: z.number().int().min(1).max(40).optional(),
    selectionMethod: z.enum(["mouse", "keyboard"]).optional(),
    page: z.string().max(240).optional(),
    timestamp: z.number().int().positive().optional(),
}).strict().superRefine((value, ctx) => {
    if (value.mode === "dashboard" && !value.guildId) {
        ctx.addIssue({
            code: "custom",
            path: ["guildId"],
            message: "guildId is required in dashboard mode",
        });
    }

    if (value.event === "search_open") {
        if (!value.trigger) {
            ctx.addIssue({
                code: "custom",
                path: ["trigger"],
                message: "trigger is required for search_open",
            });
        }
        if (value.indexSize === undefined) {
            ctx.addIssue({
                code: "custom",
                path: ["indexSize"],
                message: "indexSize is required for search_open",
            });
        }
    }

    if (value.event === "search_query") {
        if (!value.queryHash) {
            ctx.addIssue({
                code: "custom",
                path: ["queryHash"],
                message: "queryHash is required for search_query",
            });
        }
        if (value.queryLength === undefined) {
            ctx.addIssue({
                code: "custom",
                path: ["queryLength"],
                message: "queryLength is required for search_query",
            });
        }
        if (value.resultCount === undefined) {
            ctx.addIssue({
                code: "custom",
                path: ["resultCount"],
                message: "resultCount is required for search_query",
            });
        }
    }

    if (value.event === "search_select") {
        if (!value.selectedEntryId) {
            ctx.addIssue({
                code: "custom",
                path: ["selectedEntryId"],
                message: "selectedEntryId is required for search_select",
            });
        }
        if (!value.selectedSource) {
            ctx.addIssue({
                code: "custom",
                path: ["selectedSource"],
                message: "selectedSource is required for search_select",
            });
        }
        if (value.selectedRank === undefined) {
            ctx.addIssue({
                code: "custom",
                path: ["selectedRank"],
                message: "selectedRank is required for search_select",
            });
        }
        if (!value.selectionMethod) {
            ctx.addIssue({
                code: "custom",
                path: ["selectionMethod"],
                message: "selectionMethod is required for search_select",
            });
        }
        if (value.resultCount === undefined) {
            ctx.addIssue({
                code: "custom",
                path: ["resultCount"],
                message: "resultCount is required for search_select",
            });
        }
    }
});

function getClientAddress(req: NextRequest): string {
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0]?.trim() || "unknown";
    }
    return req.headers.get("x-real-ip") || "unknown";
}

function cleanupRateLimit(now: number): void {
    for (const [key, entry] of rateLimitMap.entries()) {
        if (entry.resetAt <= now) {
            rateLimitMap.delete(key);
        }
    }

    if (rateLimitMap.size <= MAX_RATE_LIMIT_KEYS) return;

    const ordered = Array.from(rateLimitMap.entries())
        .sort((a, b) => a[1].updatedAt - b[1].updatedAt);

    const overflow = rateLimitMap.size - MAX_RATE_LIMIT_KEYS;
    for (let index = 0; index < overflow; index += 1) {
        const [key] = ordered[index] ?? [];
        if (key) {
            rateLimitMap.delete(key);
        }
    }
}

function isRateLimited(key: string): boolean {
    const now = Date.now();
    cleanupRateLimit(now);

    const existing = rateLimitMap.get(key);
    if (!existing || existing.resetAt <= now) {
        rateLimitMap.set(key, {
            count: 1,
            resetAt: now + RATE_LIMIT_WINDOW_MS,
            updatedAt: now,
        });
        return false;
    }

    existing.count += 1;
    existing.updatedAt = now;

    return existing.count > RATE_LIMIT_MAX_REQUESTS;
}

export async function POST(req: NextRequest) {
    let parsedBody: z.infer<typeof telemetryPayloadSchema>;

    try {
        const body = await req.json();
        const parsed = telemetryPayloadSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid telemetry payload", details: parsed.error.issues },
                { status: 400 }
            );
        }
        parsedBody = parsed.data;
    } catch {
        return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const clientAddress = getClientAddress(req);
    const userAgent = req.headers.get("user-agent")?.slice(0, 120) || "unknown";
    let actor = clientAddress === "unknown"
        ? `ua:${userAgent}`
        : `ip:${clientAddress}`;
    let userId: string | undefined;

    if (parsedBody.mode === "dashboard") {
        // Keep telemetry lightweight: session check only.
        // Do not call guild permission validation here to avoid burning shared
        // per-guild API rate budget used by feature endpoints.
        const sessionResult = await requireSession(req);
        if ("response" in sessionResult) {
            return new NextResponse(null, { status: 204 });
        }
        userId = sessionResult.userId;
        actor = `user:${sessionResult.userId}`;
    }

    if (isRateLimited(actor)) {
        return NextResponse.json({ error: "Too many telemetry requests" }, { status: 429 });
    }

    logger.info("Search telemetry event", {
        event: parsedBody.event,
        mode: parsedBody.mode,
        guildId: parsedBody.guildId,
        userId,
        trigger: parsedBody.trigger,
        indexSize: parsedBody.indexSize,
        queryHash: parsedBody.queryHash,
        queryLength: parsedBody.queryLength,
        tokenCount: parsedBody.tokenCount,
        resultCount: parsedBody.resultCount,
        topSources: parsedBody.topSources,
        selectedEntryId: parsedBody.selectedEntryId,
        selectedSource: parsedBody.selectedSource,
        selectedRank: parsedBody.selectedRank,
        selectionMethod: parsedBody.selectionMethod,
        page: parsedBody.page,
        clientTimestamp: parsedBody.timestamp,
    });

    return new NextResponse(null, { status: 204 });
}
