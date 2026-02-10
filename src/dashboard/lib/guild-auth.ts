import { getServerSession, type Session } from "next-auth";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

const MANAGE_GUILD = 0x20n;
const MANAGE_ROLES = 0x10000000n;
const GUILD_CACHE_TTL_MS = 30_000; // 30 seconds - shorter to reduce rate limits
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60; // Reduced from 120
const MAX_GUILD_CACHE_ENTRIES = 2_000;

interface GuildAccessCacheEntry {
    guildPermissions: Map<string, DiscordGuildPermissionPayload>;
    expiresAt: number;
    cachedAt: number;
}

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

interface DiscordGuildPermissionPayload {
    id: string;
    owner: boolean;
    permissions: string;
}

export interface GuildAuthSuccess {
    session: Session;
    userId: string;
    accessToken: string;
}

interface GuildAuthFailure {
    response: NextResponse;
}

const guildAccessCache = new Map<string, GuildAccessCacheEntry>();
const rateLimitCache = new Map<string, RateLimitEntry>();

function jsonError(status: number, error: string): GuildAuthFailure {
    return {
        response: NextResponse.json({ error }, { status }),
    };
}

function isFailure(result: GuildAuthSuccess | GuildAuthFailure): result is GuildAuthFailure {
    return "response" in result;
}

function cleanupRateLimit(now: number): void {
    for (const [key, value] of rateLimitCache.entries()) {
        if (value.resetAt <= now) {
            rateLimitCache.delete(key);
        }
    }
}

function cleanupGuildAccessCache(now: number): void {
    for (const [key, value] of guildAccessCache.entries()) {
        if (value.expiresAt <= now) {
            guildAccessCache.delete(key);
        }
    }

    if (guildAccessCache.size <= MAX_GUILD_CACHE_ENTRIES) {
        return;
    }

    const entries = Array.from(guildAccessCache.entries()).sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    const overflow = guildAccessCache.size - MAX_GUILD_CACHE_ENTRIES;
    for (let i = 0; i < overflow; i += 1) {
        const [key] = entries[i] ?? [];
        if (key) {
            guildAccessCache.delete(key);
        }
    }
}

function enforceRateLimit(key: string): GuildAuthFailure | null {
    const now = Date.now();
    cleanupRateLimit(now);

    const existing = rateLimitCache.get(key);
    if (!existing || existing.resetAt <= now) {
        rateLimitCache.set(key, {
            count: 1,
            resetAt: now + RATE_LIMIT_WINDOW_MS,
        });
        return null;
    }

    existing.count += 1;
    if (existing.count > RATE_LIMIT_MAX_REQUESTS) {
        return jsonError(429, "Too many requests");
    }

    return null;
}

function hasRequiredPermissions(
    guild: DiscordGuildPermissionPayload | undefined,
    requiredPermissions: bigint[]
): boolean {
    if (!guild) return false;
    if (guild.owner) return true;

    const permissions = BigInt(guild.permissions);
    return requiredPermissions.every((permission) => (permissions & permission) === permission);
}

async function getGuildPermissions(
    userId: string,
    accessToken: string
): Promise<Map<string, DiscordGuildPermissionPayload> | GuildAuthFailure> {
    const now = Date.now();
    cleanupGuildAccessCache(now);
    const cached = guildAccessCache.get(userId);

    if (cached && cached.expiresAt > now) {
        return cached.guildPermissions;
    }

    let response: Response;
    try {
        response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            cache: "no-store",
        });
    } catch {
        return jsonError(503, "Failed to validate guild permissions");
    }

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            return jsonError(401, "Unauthorized");
        }
        return jsonError(503, "Failed to validate guild permissions");
    }

    const guilds = await response.json() as DiscordGuildPermissionPayload[];
    const guildPermissions = new Map<string, DiscordGuildPermissionPayload>();
    for (const guild of guilds) guildPermissions.set(guild.id, guild);

    guildAccessCache.set(userId, {
        guildPermissions,
        expiresAt: now + GUILD_CACHE_TTL_MS,
        cachedAt: now,
    });

    return guildPermissions;
}

export async function requireSession(req: NextRequest): Promise<GuildAuthSuccess | GuildAuthFailure> {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return jsonError(401, "Unauthorized");
    }

    const userId = session.user.id;
    if (!userId) {
        return jsonError(401, "Unauthorized");
    }

    const token = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
    });

    const accessToken = typeof token?.accessToken === "string" ? token.accessToken : null;
    if (!accessToken) {
        return jsonError(401, "Unauthorized");
    }

    return {
        session,
        userId,
        accessToken,
    };
}

async function requireGuildAccess(
    guildId: string,
    req: NextRequest,
    requiredPermissions: bigint[]
): Promise<GuildAuthSuccess | GuildAuthFailure> {
    const sessionResult = await requireSession(req);
    if (isFailure(sessionResult)) {
        return sessionResult;
    }

    const rateLimitResult = enforceRateLimit(`${sessionResult.userId}:${guildId}`);
    if (rateLimitResult) {
        return rateLimitResult;
    }

    const guildPermissionsResult = await getGuildPermissions(sessionResult.userId, sessionResult.accessToken);
    if (guildPermissionsResult instanceof Map) {
        const guild = guildPermissionsResult.get(guildId);
        if (!hasRequiredPermissions(guild, requiredPermissions)) {
            return jsonError(403, "Forbidden");
        }
        return sessionResult;
    }

    return guildPermissionsResult;
}

export async function requireGuildManageAccess(
    guildId: string,
    req: NextRequest
): Promise<GuildAuthSuccess | GuildAuthFailure> {
    return requireGuildAccess(guildId, req, [MANAGE_GUILD]);
}

export async function requireGuildManageRolesAccess(
    guildId: string,
    req: NextRequest
): Promise<GuildAuthSuccess | GuildAuthFailure> {
    return requireGuildAccess(guildId, req, [MANAGE_GUILD, MANAGE_ROLES]);
}
