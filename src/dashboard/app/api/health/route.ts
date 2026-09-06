import { NextRequest, NextResponse } from "next/server";
import { checkPoolHealth, getPoolMetrics } from "@shared/database/client";
import logger from "@/lib/logger";

interface HealthCheck {
    name: string;
    healthy: boolean;
    responseTime: number;
    message?: string;
}

function isDetailedHealthAuthorized(request: NextRequest): boolean {
    const configuredToken = process.env.METRICS_TOKEN;
    if (!configuredToken) {
        return process.env.NODE_ENV !== "production";
    }

    const bearer = request.headers.get("authorization");
    if (!bearer?.startsWith("Bearer ")) {
        return false;
    }

    return bearer.slice("Bearer ".length).trim() === configuredToken;
}

/**
 * Health check endpoint for monitoring and load balancers
 * Returns 200 if healthy, 503 if unhealthy
 */
export async function GET() {
    const startTime = Date.now();
    const checks: HealthCheck[] = [];

    // Check database
    const dbStart = Date.now();
    try {
        const dbHealth = await checkPoolHealth();
        checks.push({
            name: "database",
            healthy: dbHealth.healthy,
            responseTime: Date.now() - dbStart,
            message: dbHealth.healthy ? undefined : "Database connection failed"
        });
    } catch (error) {
        checks.push({
            name: "database",
            healthy: false,
            responseTime: Date.now() - dbStart,
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }

    // Check Discord bot connection (if applicable)
    const discordStart = Date.now();
    const discordHealthy = !!process.env.DISCORD_TOKEN;
    checks.push({
        name: "discord_config",
        healthy: discordHealthy,
        responseTime: Date.now() - discordStart,
        message: discordHealthy ? undefined : "Discord token not configured"
    });

    // Overall health
    const healthy = checks.every(c => c.healthy);
    const totalResponseTime = Date.now() - startTime;

    const response = {
        status: healthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        responseTime: totalResponseTime,
        version: process.env.npm_package_version || "unknown",
        checks: checks.reduce((acc, check) => ({
            ...acc,
            [check.name]: {
                healthy: check.healthy,
                responseTime: check.responseTime,
                message: check.message
            }
        }), {})
    };

    // Log if unhealthy
    if (!healthy) {
        logger.error("Health check failed", response);
    }

    return NextResponse.json(response, {
        status: healthy ? 200 : 503
    });
}

/**
 * Detailed health check with metrics
 * For internal monitoring use
 */
export async function POST(request: NextRequest) {
    if (!isDetailedHealthAuthorized(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const checks: HealthCheck[] = [];

    // Database health with metrics
    const dbStart = Date.now();
    try {
        const dbHealth = await checkPoolHealth();
        const poolMetrics = getPoolMetrics();

        checks.push({
            name: "database",
            healthy: dbHealth.healthy,
            responseTime: Date.now() - dbStart,
            message: dbHealth.healthy
                ? `Pool: ${poolMetrics.total} total, ${poolMetrics.idle} idle, ${poolMetrics.waiting} waiting`
                : "Database connection failed"
        });
    } catch (error) {
        checks.push({
            name: "database",
            healthy: false,
            responseTime: Date.now() - dbStart,
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }

    // Memory usage
    const memUsage = process.memoryUsage();
    const memHealthy = memUsage.heapUsed < 1024 * 1024 * 1024; // 1GB threshold

    checks.push({
        name: "memory",
        healthy: memHealthy,
        responseTime: 0,
        message: `Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB, RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`
    });

    const healthy = checks.every(c => c.healthy);

    return NextResponse.json({
        status: healthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        checks
    }, {
        status: healthy ? 200 : 503
    });
}
