import { NextRequest, NextResponse } from "next/server";
import { getPoolMetrics } from "@shared/database/client";
import logger from "@/lib/logger";
import { getRateLimitStoreMetrics } from "@/lib/rate-limit";
import { getDiscordCacheMetrics } from "@/lib/discord-cache";

function isAuthorized(request: NextRequest): boolean {
    const configuredToken = process.env.METRICS_TOKEN;
    if (!configuredToken) {
        return process.env.NODE_ENV !== "production";
    }

    const bearer = request.headers.get("authorization");
    if (!bearer?.startsWith("Bearer ")) {
        return false;
    }

    const token = bearer.slice("Bearer ".length).trim();
    return token === configuredToken;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const pool = getPoolMetrics();
        const rateLimit = getRateLimitStoreMetrics();
        const discordCache = getDiscordCacheMetrics();
        const memory = process.memoryUsage();

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            uptimeSeconds: Math.floor(process.uptime()),
            nodeEnv: process.env.NODE_ENV,
            pool,
            rateLimit,
            discordCache,
            memory: {
                rssBytes: memory.rss,
                heapTotalBytes: memory.heapTotal,
                heapUsedBytes: memory.heapUsed,
                externalBytes: memory.external,
                arrayBuffersBytes: memory.arrayBuffers,
            },
        });
    } catch (error) {
        logger.error("Metrics endpoint failed", { error });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
