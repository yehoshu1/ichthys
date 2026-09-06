import { db, dashboardRbacConfig, dashboardRbacRules } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import logger from './logger';

// ─── Permission Constants ──────────────────────────────────────────────────────

const ADMINISTRATOR = 0x8n;
const MANAGE_GUILD = 0x20n;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DiscordGuildInfo {
    id: string;
    owner: boolean;
    permissions: string;
}

export type RbacAction = 'view' | 'edit';
export type RbacDefaultAccess = 'manage_guild_only' | 'deny';

// ─── Bot Member Role Cache ──────────────────────────────────────────────────────

interface MemberRolesCacheEntry {
    roles: string[];
    expiresAt: number;
}

const memberRolesCache = new Map<string, MemberRolesCacheEntry>();
const MEMBER_CACHE_TTL_MS = 60_000; // 60 seconds
const MAX_MEMBER_CACHE_ENTRIES = 5_000;

/**
 * Evicts all expired entries, then — if still over capacity — removes the
 * entries that will expire soonest (i.e. those with the oldest cached data).
 *
 * Previously this only ran when the cache exceeded its maximum size, meaning
 * expired entries would persist indefinitely in low-traffic deployments and
 * grant stale permissions until the process restarted.
 */
function cleanupMemberRolesCache(now: number): void {
    // Always evict expired entries to enforce the 60-second TTL.
    for (const [key, entry] of memberRolesCache.entries()) {
        if (entry.expiresAt <= now) {
            memberRolesCache.delete(key);
        }
    }

    // If still over capacity after expiry cleanup, evict the entries that
    // expire soonest (they hold the oldest cached data).
    if (memberRolesCache.size > MAX_MEMBER_CACHE_ENTRIES) {
        const entries = Array.from(memberRolesCache.entries())
            .sort((a, b) => a[1].expiresAt - b[1].expiresAt);
        const overflow = memberRolesCache.size - MAX_MEMBER_CACHE_ENTRIES;
        for (let i = 0; i < overflow; i++) {
            memberRolesCache.delete(entries[i][0]);
        }
    }
}

/**
 * Fetch the role IDs for a guild member via the bot token.
 * Results are cached for 60 seconds to prevent Discord API rate limits.
 */
export async function fetchBotMemberRoles(guildId: string, userId: string): Promise<string[]> {
    const cacheKey = `${guildId}:${userId}`;
    const now = Date.now();
    cleanupMemberRolesCache(now);

    const cached = memberRolesCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
        return cached.roles;
    }

    const botToken = process.env.DISCORD_TOKEN;
    if (!botToken) {
        logger.warn('DISCORD_TOKEN not set; cannot fetch member roles for RBAC');
        return [];
    }

    try {
        const response = await fetch(
            `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
            {
                headers: { Authorization: `Bot ${botToken}` },
                cache: 'no-store',
            }
        );

        if (!response.ok) {
            logger.warn('Failed to fetch member roles from Discord', {
                status: response.status,
                guildId,
                userId,
            });
            return [];
        }

        const member = await response.json() as { roles?: string[] };
        const roles = Array.isArray(member.roles) ? member.roles : [];

        memberRolesCache.set(cacheKey, { roles, expiresAt: now + MEMBER_CACHE_TTL_MS });
        return roles;
    } catch (error) {
        logger.warn('Error fetching member roles for RBAC', {
            error: error instanceof Error ? error.message : String(error),
            guildId,
            userId,
        });
        return [];
    }
}

// ─── Hard Bypass Check ─────────────────────────────────────────────────────────

/**
 * Returns true if the user is a guild owner, has ADMINISTRATOR, or has MANAGE_GUILD.
 * These users have unrestricted access to all modules regardless of RBAC config.
 */
export function isHardBypassUser(guild: DiscordGuildInfo | undefined): boolean {
    if (!guild) return false;
    if (guild.owner) return true;

    const perms = BigInt(guild.permissions);
    if ((perms & ADMINISTRATOR) === ADMINISTRATOR) return true;
    if ((perms & MANAGE_GUILD) === MANAGE_GUILD) return true;

    return false;
}

export function resolveDefaultModuleAccess(
    defaultAccess: RbacDefaultAccess,
    guild: DiscordGuildInfo | undefined
): ModuleAccessResult {
    if (defaultAccess === 'manage_guild_only' && isHardBypassUser(guild)) {
        return { view: true, edit: true };
    }

    return { view: false, edit: false };
}

function resolveRuleAccess(rule: { allowedViewRoles?: string[] | null; allowedEditRoles?: string[] | null }, userRoles: string[]): ModuleAccessResult {
    const editRoles = rule.allowedEditRoles ?? [];
    const viewRoles = rule.allowedViewRoles ?? [];

    const canEdit = editRoles.some((r) => userRoles.includes(r));
    // Edit roles implicitly grant view access.
    const canView = canEdit || viewRoles.some((r) => userRoles.includes(r));

    return { view: canView, edit: canEdit };
}

// ─── Module ID Extraction ──────────────────────────────────────────────────────

/**
 * Extract the dashboard module ID from an API pathname.
 * Example: /api/guilds/123456/welcome/config → 'welcome'
 * Example: /api/guilds/123456/role-actions → 'role-actions'
 */
export function getModuleIdFromPath(pathname: string): string {
    const match = pathname.match(/^\/api\/guilds\/[^/]+\/([^/]+)/);
    return match?.[1] ?? 'core';
}

// ─── RBAC Evaluation ───────────────────────────────────────────────────────────

/**
 * Evaluate whether a user is permitted to perform `action` on `moduleId` in `guildId`.
 *
 * Evaluation order:
 *  A. Hard bypass (owner / ADMINISTRATOR / MANAGE_GUILD) → allow immediately
 *  B. Fetch dashboardRbacConfig; if missing or disabled → deny
 *  C. Fetch user's Discord role IDs via bot token
 *  D. Fetch dashboardRbacRules for (guildId, moduleId)
 *  E. If rule exists: check edit roles (edit implies view), then view roles
 *  F. If no rule exists: fall back to dashboardRbacConfig.defaultAccess.
 */
export async function evaluateRbac(
    guildId: string,
    userId: string,
    moduleId: string,
    action: RbacAction,
    guild: DiscordGuildInfo | undefined
): Promise<boolean> {
    // Step A: Hard bypass
    if (isHardBypassUser(guild)) return true;

    // Step B: Fetch RBAC config
    const [config] = await db
        .select()
        .from(dashboardRbacConfig)
        .where(eq(dashboardRbacConfig.guildId, guildId))
        .limit(1);

    if (!config || !config.enabled) {
        return false;
    }

    // Step C: Fetch user's role IDs from Discord
    const userRoles = await fetchBotMemberRoles(guildId, userId);

    // Step D: Fetch rule for this module
    const [rule] = await db
        .select()
        .from(dashboardRbacRules)
        .where(
            and(
                eq(dashboardRbacRules.guildId, guildId),
                eq(dashboardRbacRules.moduleId, moduleId)
            )
        )
        .limit(1);

    // Step E: Rule exists — check role intersections
    if (rule) {
        const access = resolveRuleAccess(rule, userRoles);
        return action === 'edit' ? access.edit : access.view;
    }

    // Step F: No rule — use configured fallback.
    const fallbackAccess = resolveDefaultModuleAccess(config.defaultAccess, guild);
    return action === 'edit' ? fallbackAccess.edit : fallbackAccess.view;
}

// ─── Batch RBAC Evaluation ─────────────────────────────────────────────────────

export interface ModuleAccessResult {
    view: boolean;
    edit: boolean;
}

/**
 * Evaluate a user's access for multiple modules in a single operation.
 *
 * Unlike calling evaluateRbac() for each module (which issues separate DB
 * queries for every module), this function fetches the RBAC config once, the
 * user's Discord roles once (using the shared 60-second cache), and all
 * applicable rules in a single query — then evaluates everything in memory.
 *
 * Use this in the /me/access endpoint to avoid O(n) database round-trips.
 */
export async function evaluateRbacBatch(
    guildId: string,
    userId: string,
    moduleIds: readonly string[],
    guild: DiscordGuildInfo | undefined
): Promise<Record<string, ModuleAccessResult>> {
    const allow = (): ModuleAccessResult => ({ view: true, edit: true });

    // Step A: Hard bypass — all modules get full access immediately.
    if (isHardBypassUser(guild)) {
        return Object.fromEntries(moduleIds.map((id) => [id, allow()]));
    }

    // Step B: Fetch RBAC config once.
    const [config] = await db
        .select()
        .from(dashboardRbacConfig)
        .where(eq(dashboardRbacConfig.guildId, guildId))
        .limit(1);

    if (!config || !config.enabled) {
        return Object.fromEntries(moduleIds.map((id) => [id, { view: false, edit: false }]));
    }

    // Step C: Fetch user's role IDs once (uses 60-second cache).
    const userRoles = await fetchBotMemberRoles(guildId, userId);

    // Step D: Fetch all rules for this guild in a single query.
    const allRules = await db
        .select()
        .from(dashboardRbacRules)
        .where(eq(dashboardRbacRules.guildId, guildId));

    const rulesByModule = new Map(allRules.map((r) => [r.moduleId, r]));

    // Step E/F: Evaluate each module against the fetched rules.
    const result: Record<string, ModuleAccessResult> = {};
    for (const moduleId of moduleIds) {
        const rule = rulesByModule.get(moduleId);

        if (!rule) {
            // Step F: No rule → use configured fallback (same as evaluateRbac Step F).
            result[moduleId] = resolveDefaultModuleAccess(config.defaultAccess, guild);
            continue;
        }

        result[moduleId] = resolveRuleAccess(rule, userRoles);
    }

    return result;
}
