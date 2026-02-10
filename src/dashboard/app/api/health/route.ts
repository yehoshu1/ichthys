import { NextResponse } from "next/server";
import { db } from "@shared/database/client";
import { sql } from "drizzle-orm";
import logger from "@/lib/logger";

interface HealthStatus {
    status: "healthy" | "degraded" | "unhealthy";
    timestamp: string;
    version: string;
    services: {
        database: {
            status: "healthy" | "unhealthy";
            responseTimeMs: number;
            error?: string;
        };
        discord: {
            status: "healthy" | "unhealthy";
            responseTimeMs: number;
            error?: string;
        };
    };
    uptime: number;
}

const START_TIME = Date.now();

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<{ status: "healthy" | "unhealthy"; responseTimeMs: number; error?: string }> {
    const start = Date.now();
    try {
        // Simple query to check connectivity
        await db.execute(sql`SELECT 1`);
        return {
            status: "healthy",
            responseTimeMs: Date.now() - start,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error("Health check: Database connection failed", { error: message });
        return {
            status: "unhealthy",
            responseTimeMs: Date.now() - start,
            error: message,
        };
    }
}

/**
 * Check Discord API connectivity
 */
async function checkDiscord(): Promise<{ status: "healthy" | "unhealthy"; responseTimeMs: number; error?: string }> {
    const start = Date.now();
    try {
        const response = await fetch("https://discord.com/api/v10/gateway", {
            method: "GET",
            cache: "no-store",
        });

        if (!response.ok) {
            throw new Error(`Discord API returned ${response.status}`);
        }

        return {
            status: "healthy",
            responseTimeMs: Date.now() - start,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error("Health check: Discord API connection failed", { error: message });
        return {
            status: "unhealthy",
            responseTimeMs: Date.now() - start,
            error: message,
        };
    }
}

/**
 * GET /api/health
 * Comprehensive health check endpoint
 */
export async function GET(): Promise<NextResponse> {
    const [database, discord] = await Promise.all([
        checkDatabase(),
        checkDiscord(),
    ]);

    // Determine overall status
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (database.status === "unhealthy" && discord.status === "unhealthy") {
        status = "unhealthy";
    } else if (database.status === "unhealthy" || discord.status === "unhealthy") {
        status = "degraded";
    }

    const health: HealthStatus = {
        status,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "1.0.0",
        services: {
            database,
            discord,
        },
        uptime: Date.now() - START_TIME,
    };

    // Return appropriate status code
    const statusCode = status === "healthy" ? 200 : status === "degraded" ? 200 : 503;

    return NextResponse.json(health, {
        status: statusCode,
        headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
        },
    });
}

/**
 * HEAD /api/health
 * Lightweight health check for load balancers
 */
export async function HEAD(): Promise<NextResponse> {
    return new NextResponse(null, { status: 200 });
}
