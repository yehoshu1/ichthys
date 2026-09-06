import { getServerSession, type Session } from "next-auth";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import logger from "./logger";
import { requireGuildModuleEnabledForPath } from "./module-gate";
import { requireSameOrigin } from "./csrf";
import { buildRateLimitKey, checkRateLimit, DEFAULT_RATE_LIMIT } from "./rate-limit";
import {
    evaluateRbac,
    evaluateRbacBatchHasAnyAccess,
    getModuleIdFromPath,
    isRbacEnabled,
    type DiscordGuildInfo,
} from "./rbac";
import { RBAC_MODULE_IDS } from "./rbac-modules";

const MANAGE_GUILD = 0x20n;
const MANAGE_ROLES = 0x10000000n;
const ADMINISTRATOR = 0x8n;
const GUILD_CACHE_TTL_MS = 5 * 60_000; // 5 minutes
const GUILD_CACHE_STALE_WINDOW_MS = 2 * 60_000; // Serve stale data on Discord failures (short window: auth-critical)
const MAX_GUILD_CACHE_ENTRIES = 2_000;

interface GuildAccessCacheEntry {
    guildPermissions: Map<string, DiscordGuildInfo>;
    expiresAt: number;
    staleUntil: number;
    cachedAt: number;
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
const guildPermissionsInFlight = new Map<string, Promise<Map<string, DiscordGuildInfo> | GuildAuthFailure>>();

function jsonError(status: number, error: string): GuildAuthFailure {
    return {
        response: NextResponse.json({ error }, { status }),
    };
}

function isFailure(result: GuildAuthSuccess | GuildAuthFailure): result is GuildAuthFailure {
    return "response" in result;
}

function cleanupGuildAccessCache(now: number): void {
    for (const [key, value] of guildAccessCache.entries()) {
        if (value.staleUntil <= now) {
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

function hasRequiredPermissions(
    guild: DiscordGuildInfo | undefined,
    requiredPermissions: bigint[]
): boolean {
    if (!guild) return false;
    if (guild.owner) return true;

    const permissions = BigInt(guild.permissions);
    // ADMINISTRATOR implicitly grants all permissions
    if ((permissions & ADMINISTRATOR) === ADMINISTRATOR) return true;
    return requiredPermissions.every((permission) => (permissions & permission) === permission);
}

async function getGuildPermissions(
    userId: string,
    accessToken: string
): Promise<Map<string, DiscordGuildInfo> | GuildAuthFailure> {
    const now = Date.now();
    cleanupGuildAccessCache(now);
    const cached = guildAccessCache.get(userId);

    if (cached && cached.expiresAt > now) {
        return cached.guildPermissions;
    }

    const inFlight = guildPermissionsInFlight.get(userId);
    if (inFlight) {
        return inFlight;
    }

    const request = (async () => {
        let response: Response;
        try {
            response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                cache: "no-store",
            });
        } catch (error) {
            logger.error("Failed to fetch guilds from Discord:", error);
            if (cached && cached.staleUntil > Date.now()) {
                logger.warn("Using stale guild permissions cache after Discord network failure", { userId });
                return cached.guildPermissions;
            }
            return jsonError(503, "Failed to validate guild permissions - network error");
        }

        if (!response.ok) {
            const errorText = await response.text().catch(() => "unknown");
            logger.error("Discord API error:", { status: response.status, error: errorText });

            if (response.status === 401 || response.status === 403) {
                return jsonError(401, "Unauthorized - Discord token invalid");
            }

            if (response.status === 429 && cached && cached.staleUntil > Date.now()) {
                logger.warn("Using stale guild permissions cache after Discord rate limit", { userId });
                return cached.guildPermissions;
            }

            if (response.status === 429) {
                return jsonError(503, "Failed to validate guild permissions - Discord API rate limit");
            }

            return jsonError(503, `Failed to validate guild permissions - Discord API ${response.status}`);
        }

        const guilds = await response.json() as DiscordGuildInfo[];
        const guildPermissions = new Map<string, DiscordGuildInfo>();
        for (const guild of guilds) guildPermissions.set(guild.id, guild);

        const cachedAt = Date.now();
        guildAccessCache.set(userId, {
            guildPermissions,
            expiresAt: cachedAt + GUILD_CACHE_TTL_MS,
            staleUntil: cachedAt + GUILD_CACHE_STALE_WINDOW_MS,
            cachedAt,
        });

        return guildPermissions;
    })().finally(() => {
        guildPermissionsInFlight.delete(userId);
    });

    guildPermissionsInFlight.set(userId, request);
    return request;
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
    requiredPermissions: bigint[],
    options: { skipRbac?: boolean } = {}
): Promise<GuildAuthSuccess | GuildAuthFailure> {
    const sessionResult = await requireSession(req);
    if (isFailure(sessionResult)) {
        return sessionResult;
    }

    const rateLimit = await checkRateLimit(buildRateLimitKey(req, `session:${sessionResult.userId}`), DEFAULT_RATE_LIMIT);
    if (!rateLimit.allowed) {
        return jsonError(429, "Too many requests");
    }

    const csrfFailure = requireSameOrigin(req);
    if (csrfFailure) {
        return { response: csrfFailure };
    }

    const guildPermissionsResult = await getGuildPermissions(sessionResult.userId, sessionResult.accessToken);
    if (guildPermissionsResult instanceof Map) {
        const guild = guildPermissionsResult.get(guildId);

        if (hasRequiredPermissions(guild, requiredPermissions)) {
            const moduleGuardResponse = await requireGuildModuleEnabledForPath(guildId, req.nextUrl.pathname);
            if (moduleGuardResponse) {
                return { response: moduleGuardResponse };
            }
            return sessionResult;
        }

        // Discord-level permission check failed. If RBAC is enabled for this
        // guild, delegated access is decided by RBAC rules instead.
        if (options.skipRbac) {
            return jsonError(403, "Forbidden - You don't have permission to access this resource");
        }

        if (await isRbacEnabled(guildId)) {
            const moduleId = getModuleIdFromPath(req.nextUrl.pathname);
            const action = req.method === 'GET' ? 'view' : 'edit';
            const rbacAllowed = await evaluateRbac(guildId, sessionResult.userId, moduleId, action, guild).catch((err) => {
                logger.error("RBAC evaluation error", { error: err instanceof Error ? err.message : String(err), guildId, userId: sessionResult.userId });
                return false as const;
            });

            if (rbacAllowed) {
                const moduleGuardResponse = await requireGuildModuleEnabledForPath(guildId, req.nextUrl.pathname);
                if (moduleGuardResponse) {
                    return { response: moduleGuardResponse };
                }
                return sessionResult;
            }
        }

        logger.warn("Permission denied", { guildId, userId: sessionResult.userId, viaRbac: false });
        return jsonError(403, "Forbidden - You don't have permission to access this resource");
    }

    return guildPermissionsResult;
}

export async function requireGuildManageAccess(
    guildId: string,
    req: NextRequest
): Promise<GuildAuthSuccess | GuildAuthFailure> {
    return requireGuildAccess(guildId, req, [MANAGE_GUILD]);
}

/**
 * Strict access check: requires MANAGE_GUILD (or owner/ADMINISTRATOR).
 * RBAC delegation is intentionally skipped — use this for the RBAC
 * configuration endpoint itself and other routes that must never be delegatable.
 */
export async function requireGuildManageStrictAccess(
    guildId: string,
    req: NextRequest
): Promise<GuildAuthSuccess | GuildAuthFailure> {
    return requireGuildAccess(guildId, req, [MANAGE_GUILD], { skipRbac: true });
}

export async function requireGuildManageRolesAccess(
    guildId: string,
    req: NextRequest
): Promise<GuildAuthSuccess | GuildAuthFailure> {
    return requireGuildAccess(guildId, req, [MANAGE_GUILD, MANAGE_ROLES]);
}

/**
 * Dashboard entry gate: allows the request when the user either
 *  (a) has MANAGE_GUILD / owner / ADMINISTRATOR at the Discord level, or
 *  (b) RBAC is enabled for the guild and at least one module grants them view
 *      or edit access.
 *
 * Used by the guild-info route so members with RBAC roles can enter the
 * dashboard shell (previously they were blocked with 403 and never saw their
 * assigned modules).
 */
export async function requireGuildEntryAccess(
    guildId: string,
    req: NextRequest
): Promise<GuildAuthSuccess | GuildAuthFailure> {
    const sessionResult = await requireSession(req);
    if (isFailure(sessionResult)) {
        return sessionResult;
    }

    const rateLimit = await checkRateLimit(buildRateLimitKey(req, `session:${sessionResult.userId}`), DEFAULT_RATE_LIMIT);
    if (!rateLimit.allowed) {
        return jsonError(429, "Too many requests");
    }

    const guildPermissionsResult = await getGuildPermissions(sessionResult.userId, sessionResult.accessToken);
    if (!(guildPermissionsResult instanceof Map)) {
        return guildPermissionsResult;
    }

    const guild = guildPermissionsResult.get(guildId);
    if (hasRequiredPermissions(guild, [MANAGE_GUILD])) {
        return sessionResult;
    }

    const hasRbacAccess = await evaluateRbacBatchHasAnyAccess(
        guildId,
        sessionResult.userId,
        RBAC_MODULE_IDS,
        guild
    ).catch((err) => {
        logger.error("RBAC entry evaluation error", { error: err instanceof Error ? err.message : String(err), guildId, userId: sessionResult.userId });
        return false as const;
    });

    if (!hasRbacAccess) {
        logger.warn("Entry denied", { guildId, userId: sessionResult.userId });
        return jsonError(403, "Forbidden - You don't have permission to access this server");
    }

    return sessionResult;
}

/**
 * Retrieve guild permissions for a user (for use in non-route contexts such
 * as the /me/access endpoint).  Returns null if the user is not in the guild
 * or if fetching fails.
 */
export async function getGuildInfoForUser(
    userId: string,
    accessToken: string,
    guildId: string
): Promise<DiscordGuildInfo | null> {
    const result = await getGuildPermissions(userId, accessToken);
    if (!(result instanceof Map)) return null;
    return result.get(guildId) ?? null;
}
