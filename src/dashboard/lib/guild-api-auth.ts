import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import crypto from "crypto";
import { db, apiKey } from "@/lib/db";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import { requireGuildModuleEnabledForPath } from "@/lib/module-gate";
import { buildRateLimitKey, checkRateLimit, DEFAULT_RATE_LIMIT } from "@/lib/rate-limit";

export type ApiPermission =
    | "events:read"
    | "events:write"
    | "polls:read"
    | "polls:write"
    | "webhooks:read"
    | "webhooks:write";

export const API_PERMISSION_VALUES: Readonly<ApiPermission[]> = [
    "events:read",
    "events:write",
    "polls:read",
    "polls:write",
    "webhooks:read",
    "webhooks:write",
];

export interface GuildApiAuthContext {
    authType: "session" | "api_key";
    userId: string;
    guildId: string;
    apiKeyId?: string;
    apiKeyName?: string;
}

interface GuildApiAuthFailure {
    response: NextResponse;
}

function jsonError(status: number, error: string): GuildApiAuthFailure {
    return { response: NextResponse.json({ error }, { status }) };
}

function extractApiKeyFromRequest(request: NextRequest): string | null {
    const xApiKey = request.headers.get("x-api-key");
    if (xApiKey) {
        return xApiKey.trim();
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
        return null;
    }

    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch?.[1]) {
        return bearerMatch[1].trim();
    }

    const apiKeyMatch = authHeader.match(/^ApiKey\s+(.+)$/i);
    if (apiKeyMatch?.[1]) {
        return apiKeyMatch[1].trim();
    }

    return null;
}

function hashApiKey(rawKey: string): string {
    return crypto.createHash("sha256").update(rawKey).digest("hex");
}

function hasApiPermission(granted: string[], required: ApiPermission): boolean {
    if (granted.includes("*")) {
        return true;
    }

    if (granted.includes(required)) {
        return true;
    }

    const [resource, action] = required.split(":");
    if (action === "read" && granted.includes(`${resource}:write`)) {
        return true;
    }

    return false;
}

async function authorizeWithApiKey(
    request: NextRequest,
    guildId: string,
    requiredPermission: ApiPermission
): Promise<GuildApiAuthContext | GuildApiAuthFailure | null> {
    const rawApiKey = extractApiKeyFromRequest(request);
    if (!rawApiKey) {
        return null;
    }

    const keyHash = hashApiKey(rawApiKey);
    const rateLimit = await checkRateLimit(buildRateLimitKey(request, `api-key:${keyHash}`), DEFAULT_RATE_LIMIT);
    if (!rateLimit.allowed) {
        return jsonError(429, "Too many requests");
    }
    const [keyRecord] = await db
        .select()
        .from(apiKey)
        .where(and(eq(apiKey.guildId, guildId), eq(apiKey.keyHash, keyHash)))
        .limit(1);

    if (!keyRecord) {
        return jsonError(401, "Invalid API key");
    }

    if (!keyRecord.enabled) {
        return jsonError(403, "API key is disabled");
    }

    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
        return jsonError(403, "API key has expired");
    }

    if (!hasApiPermission(keyRecord.permissions ?? [], requiredPermission)) {
        return jsonError(403, `Missing API key permission: ${requiredPermission}`);
    }

    const moduleGuardResponse = await requireGuildModuleEnabledForPath(guildId, request.nextUrl.pathname);
    if (moduleGuardResponse) {
        return { response: moduleGuardResponse };
    }

    await db
        .update(apiKey)
        .set({
            lastUsedAt: new Date(),
            useCount: sql`${apiKey.useCount} + 1`,
            updatedAt: new Date(),
        })
        .where(eq(apiKey.id, keyRecord.id));

    return {
        authType: "api_key",
        userId: keyRecord.createdBy,
        guildId,
        apiKeyId: keyRecord.id,
        apiKeyName: keyRecord.name,
    };
}

export async function authorizeGuildApiRequest(
    request: NextRequest,
    guildId: string,
    requiredPermission: ApiPermission
): Promise<GuildApiAuthContext | GuildApiAuthFailure> {
    const apiKeyResult = await authorizeWithApiKey(request, guildId, requiredPermission);
    if (apiKeyResult && "response" in apiKeyResult) {
        return apiKeyResult;
    }
    if (apiKeyResult) {
        return apiKeyResult;
    }

    const sessionResult = await requireGuildManageAccess(guildId, request);
    if ("response" in sessionResult) {
        return { response: sessionResult.response };
    }

    return {
        authType: "session",
        userId: sessionResult.userId,
        guildId,
    };
}
